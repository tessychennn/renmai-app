// 所有 aws-amplify 相關程式碼都在這個檔案，其他地方只透過動態 import 使用，
// 這樣沒啟用雲端時這包程式不會被下載。
import { Amplify } from 'aws-amplify';
import {
  confirmSignIn,
  fetchAuthSession,
  fetchUserAttributes,
  getCurrentUser,
  signIn,
  signOut,
} from 'aws-amplify/auth';
import { generateClient } from 'aws-amplify/data';
import { downloadData, remove, uploadData } from 'aws-amplify/storage';
import type { Schema } from '../../amplify/data/resource';
import type { Group, Person, Task, TaskOption } from '../data/types';
import { AuthRequiredError } from '../sync/errors';
import type { RemoteStore } from '../sync/types';
import { amplifyOutputs } from './config';
import {
  groupToFields,
  hasCollabData,
  optionToFields,
  personToFields,
  rowToGroup,
  rowToOption,
  rowToPerson,
  rowToTask,
  taskToFields,
} from './mapping';

let configured = false;

export function configureCloud(): void {
  if (configured || !amplifyOutputs) return;
  Amplify.configure(amplifyOutputs as Parameters<typeof Amplify.configure>[0]);
  configured = true;
}

// ── 登入 ──

export type SignInOutcome = 'signed-in' | 'new-password-required';

export async function cloudSignIn(email: string, password: string): Promise<SignInOutcome> {
  configureCloud();
  try {
    const { isSignedIn, nextStep } = await signIn({ username: email.trim(), password });
    if (isSignedIn) return 'signed-in';
    if (nextStep.signInStep === 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED') {
      return 'new-password-required';
    }
    throw new Error('這個帳號需要額外的驗證步驟，目前不支援。');
  } catch (e) {
    if ((e as Error).name === 'UserAlreadyAuthenticatedException') return 'signed-in';
    throw e;
  }
}

/** 管理員建立的帳號第一次登入要換掉臨時密碼 */
export async function cloudSetNewPassword(newPassword: string): Promise<void> {
  const { isSignedIn } = await confirmSignIn({ challengeResponse: newPassword });
  if (!isSignedIn) throw new Error('設定新密碼後仍無法登入，請重新登入一次。');
}

export async function cloudSignOut(): Promise<void> {
  configureCloud();
  await signOut();
}

/** 從本機儲存的登入資訊判斷，不需要網路 */
export async function isSignedIn(): Promise<boolean> {
  configureCloud();
  try {
    await getCurrentUser();
    return true;
  } catch {
    return false;
  }
}

export async function currentEmail(): Promise<string | undefined> {
  configureCloud();
  try {
    return (await fetchUserAttributes()).email;
  } catch {
    return undefined;
  }
}

export function friendlyAuthError(e: unknown): string {
  const name = (e as Error)?.name ?? '';
  const message = (e as Error)?.message ?? '';
  if (name === 'NotAuthorizedException' || name === 'UserNotFoundException') {
    return '信箱或密碼不正確。';
  }
  if (name === 'InvalidPasswordException' || name === 'InvalidParameterException') {
    return '新密碼不符合規則：至少 8 個字元，需含大寫、小寫、數字與符號。';
  }
  if (name === 'LimitExceededException' || name === 'TooManyRequestsException') {
    return '嘗試次數太多，請稍等幾分鐘再試。';
  }
  if (name === 'ResourceNotFoundException' || name === 'InvalidUserPoolConfigurationException') {
    return '雲端設定有誤，請確認後端已部署完成。';
  }
  if (name === 'NetworkError' || /network|failed to fetch/i.test(message)) {
    return '連不上網路，請確認連線後再試。';
  }
  return message || '登入失敗，請再試一次。';
}

// ── 雲端資料 ──

const AUTH_ERROR_NAMES = new Set([
  'NotAuthorizedException',
  'UserUnAuthenticatedException',
  'Unauthorized',
  'AccessDenied',
]);

interface GraphQLErrorLike {
  message: string;
  errorType?: string;
}

function assertOk(errors: readonly GraphQLErrorLike[] | undefined): void {
  if (!errors || errors.length === 0) return;
  if (errors.some((e) => /unauthorized|not authorized/i.test(`${e.errorType ?? ''} ${e.message}`))) {
    throw new AuthRequiredError();
  }
  throw new Error(errors[0].message);
}

function mapError(e: unknown): unknown {
  const name = (e as Error)?.name;
  if (name && AUTH_ERROR_NAMES.has(name)) return new AuthRequiredError();
  return e;
}

/**
 * 目前連線的後端是否已有合作機會欄位（看 amplify_outputs.json 裡的資料表描述）。
 * 後端還沒更新或 outputs 還是舊的時，Amplify 用舊描述組查詢，新欄位會被默默丟掉；
 * 如果這時照常上傳，本機會以為已經同步成功，合作狀態就永遠到不了雲端。
 */
function introspectedModels() {
  return (
    amplifyOutputs as
      | { data?: { model_introspection?: { models?: Record<string, { fields?: Record<string, unknown> }> } } }
      | undefined
  )?.data?.model_introspection?.models;
}

function backendSupportsCollab(): boolean {
  return Boolean(introspectedModels()?.Person?.fields?.collabStatus);
}

/** 後端是否已有待辦的資料表（同樣看 amplify_outputs.json） */
function backendSupportsTasks(): boolean {
  const models = introspectedModels();
  return Boolean(models?.Task && models?.TaskOption);
}

const TASKS_NOT_DEPLOYED =
  `這支手機上的 App（版本 ${__APP_VERSION__}）用的連線設定還不含「待辦」資料表。` +
  '如果已經換過 amplify_outputs.json 並 push，請等部署完成後，把 App 完全關掉再開；' +
  '還沒換的話請先下載新檔。手機上的資料都還在，更新後會自動同步。';

/**
 * 目前登入者所屬的 Cognito 群組（例如 admin）。
 * 沒有群組回傳空陣列；讀不到（沒登入、網路問題）回傳 null，呼叫端據此沿用上次已知的身分，
 * 不會因為離線就把管理員當成一般成員。
 */
export async function currentGroups(): Promise<string[] | null> {
  configureCloud();
  try {
    const { tokens } = await fetchAuthSession();
    if (!tokens?.idToken) return null;
    const groups = tokens.idToken.payload['cognito:groups'];
    return Array.isArray(groups) ? groups.map(String) : [];
  } catch {
    return null;
  }
}

const photoPath = (id: string, variant: 'full' | 'thumb') => `photos/${id}/${variant}.jpg`;

function isNotFound(e: unknown): boolean {
  const err = e as { name?: string; $metadata?: { httpStatusCode?: number } };
  return err?.name === 'NoSuchKey' || err?.name === 'NotFound' || err?.$metadata?.httpStatusCode === 404;
}

export function createRemoteStore(): RemoteStore {
  configureCloud();
  const client = generateClient<Schema>();

  return {
    async listPersons() {
      const out: Person[] = [];
      let nextToken: string | null | undefined;
      try {
        do {
          const res = await client.models.Person.list({ limit: 500, nextToken });
          assertOk(res.errors);
          out.push(...res.data.map(rowToPerson));
          nextToken = res.nextToken;
        } while (nextToken);
      } catch (e) {
        throw mapError(e);
      }
      return out;
    },

    async listGroups() {
      const out: Group[] = [];
      let nextToken: string | null | undefined;
      try {
        do {
          const res = await client.models.Group.list({ limit: 500, nextToken });
          assertOk(res.errors);
          out.push(...res.data.map(rowToGroup));
          nextToken = res.nextToken;
        } while (nextToken);
      } catch (e) {
        throw mapError(e);
      }
      return out;
    },

    async putPerson(p) {
      const { collabStatus, collabOwner, collabNote, ...withoutCollab } = personToFields(p);
      let fields = { ...withoutCollab, collabStatus, collabOwner, collabNote };
      if (!backendSupportsCollab()) {
        // 有合作資料的人先不上傳（標記留著，後端更新後自動補傳）；沒有的人照常上傳，不帶新欄位
        if (hasCollabData(p)) {
          throw new Error(
            `這支手機上的 App（版本 ${__APP_VERSION__}）用的連線設定還不含「合作機會」欄位。` +
              '如果已經換過 amplify_outputs.json 並 push，請等部署完成後，把 App 完全關掉再開；' +
              '還沒換的話請先下載新檔。手機上的資料都還在，更新後會自動同步。'
          );
        }
        fields = withoutCollab as typeof fields;
      }
      try {
        const existing = await client.models.Person.get({ id: p.id });
        assertOk(existing.errors);
        const res = existing.data
          ? await client.models.Person.update({ id: p.id, ...fields })
          : await client.models.Person.create({ id: p.id, ...fields });
        assertOk(res.errors);
      } catch (e) {
        throw mapError(e);
      }
    },

    async putGroup(g) {
      const fields = groupToFields(g);
      try {
        const existing = await client.models.Group.get({ id: g.id });
        assertOk(existing.errors);
        const res = existing.data
          ? await client.models.Group.update({ id: g.id, ...fields })
          : await client.models.Group.create({ id: g.id, ...fields });
        assertOk(res.errors);
      } catch (e) {
        throw mapError(e);
      }
    },

    async listTasks() {
      if (!backendSupportsTasks()) return []; // 後端還沒有這張表：先當作沒資料，不要拖垮人物的同步
      const out: Task[] = [];
      let nextToken: string | null | undefined;
      try {
        do {
          const res = await client.models.Task.list({ limit: 500, nextToken });
          assertOk(res.errors);
          out.push(...res.data.map(rowToTask));
          nextToken = res.nextToken;
        } while (nextToken);
      } catch (e) {
        throw mapError(e);
      }
      return out;
    },

    async listOptions() {
      if (!backendSupportsTasks()) return [];
      const out: TaskOption[] = [];
      let nextToken: string | null | undefined;
      try {
        do {
          const res = await client.models.TaskOption.list({ limit: 500, nextToken });
          assertOk(res.errors);
          for (const row of res.data) {
            const option = rowToOption(row);
            if (option) out.push(option);
          }
          nextToken = res.nextToken;
        } while (nextToken);
      } catch (e) {
        throw mapError(e);
      }
      return out;
    },

    async putTask(t) {
      if (!backendSupportsTasks()) throw new Error(TASKS_NOT_DEPLOYED);
      const fields = taskToFields(t);
      try {
        const existing = await client.models.Task.get({ id: t.id });
        assertOk(existing.errors);
        const res = existing.data
          ? await client.models.Task.update({ id: t.id, ...fields })
          : await client.models.Task.create({ id: t.id, ...fields });
        assertOk(res.errors);
      } catch (e) {
        throw mapError(e);
      }
    },

    async putOption(o) {
      if (!backendSupportsTasks()) throw new Error(TASKS_NOT_DEPLOYED);
      const fields = optionToFields(o);
      try {
        const existing = await client.models.TaskOption.get({ id: o.id });
        assertOk(existing.errors);
        const res = existing.data
          ? await client.models.TaskOption.update({ id: o.id, ...fields })
          : await client.models.TaskOption.create({ id: o.id, ...fields });
        assertOk(res.errors);
      } catch (e) {
        // 非管理員寫入選項會被伺服器拒絕：給一句人看得懂的話
        if (/unauthorized|not authorized/i.test(String((e as Error)?.message))) {
          throw new Error('只有管理員可以修改待辦的設定（分類、成員、優先級、狀態）。');
        }
        throw mapError(e);
      }
    },

    async uploadPhoto(id, full, thumb) {
      try {
        await uploadData({
          path: photoPath(id, 'full'),
          data: full,
          options: { contentType: 'image/jpeg' },
        }).result;
        await uploadData({
          path: photoPath(id, 'thumb'),
          data: thumb,
          options: { contentType: 'image/jpeg' },
        }).result;
      } catch (e) {
        throw mapError(e);
      }
    },

    async downloadPhoto(id, variant) {
      try {
        const { body } = await downloadData({ path: photoPath(id, variant) }).result;
        return await body.blob();
      } catch (e) {
        if (isNotFound(e)) return null;
        // S3 對不存在的檔案常回 AccessDenied（不是 404）。登入明明還有效時，
        // 這只代表雲端沒有這張圖，不能當成「要重新登入」把整個同步標成失敗。
        const name = (e as Error)?.name;
        if (name && AUTH_ERROR_NAMES.has(name) && (await currentGroups()) !== null) return null;
        throw mapError(e);
      }
    },

    async deletePhotos(ids) {
      try {
        for (const id of ids) {
          await remove({ path: photoPath(id, 'full') });
          await remove({ path: photoPath(id, 'thumb') });
        }
      } catch (e) {
        throw mapError(e);
      }
    },
  };
}
