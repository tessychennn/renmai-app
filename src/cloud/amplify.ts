// 所有 aws-amplify 相關程式碼都在這個檔案，其他地方只透過動態 import 使用，
// 這樣沒啟用雲端時這包程式不會被下載。
import { Amplify } from 'aws-amplify';
import {
  confirmSignIn,
  fetchUserAttributes,
  getCurrentUser,
  signIn,
  signOut,
} from 'aws-amplify/auth';
import { generateClient } from 'aws-amplify/data';
import { downloadData, remove, uploadData } from 'aws-amplify/storage';
import type { Schema } from '../../amplify/data/resource';
import type { Group, Person } from '../data/types';
import { AuthRequiredError } from '../sync/errors';
import type { RemoteStore } from '../sync/types';
import { amplifyOutputs } from './config';

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

const strings = (values: readonly (string | null)[] | null | undefined): string[] =>
  (values ?? []).filter((v): v is string => v !== null);

function toPerson(row: Schema['Person']['type']): Person {
  return {
    id: row.id,
    displayName: row.displayName,
    lineName: row.lineName ?? undefined,
    avatarPhotoId: row.avatarPhotoId ?? undefined,
    photoIds: strings(row.photoIds),
    groupIds: strings(row.groupIds),
    occasion: row.occasion ?? undefined,
    metDate: row.metDate ?? undefined,
    note: row.note ?? undefined,
    createdAt: row.clientCreatedAt,
    updatedAt: row.clientUpdatedAt,
    deletedAt: row.deletedAt ?? undefined,
  };
}

function toGroup(row: Schema['Group']['type']): Group {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    order: row.order,
    updatedAt: row.clientUpdatedAt,
    deletedAt: row.deletedAt ?? undefined,
  };
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
          out.push(...res.data.map(toPerson));
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
          out.push(...res.data.map(toGroup));
          nextToken = res.nextToken;
        } while (nextToken);
      } catch (e) {
        throw mapError(e);
      }
      return out;
    },

    async putPerson(p) {
      // 欄位一律明確送出（沒有的送 null），使用者清掉場合／備註時才會真的清掉雲端的值
      const fields = {
        displayName: p.displayName,
        lineName: p.lineName ?? null,
        avatarPhotoId: p.avatarPhotoId ?? null,
        photoIds: p.photoIds,
        groupIds: p.groupIds,
        occasion: p.occasion ?? null,
        metDate: p.metDate ?? null,
        note: p.note ?? null,
        clientCreatedAt: p.createdAt,
        clientUpdatedAt: p.updatedAt,
        deletedAt: p.deletedAt ?? null,
      };
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
      const fields = {
        name: g.name,
        color: g.color,
        order: g.order,
        clientUpdatedAt: g.updatedAt,
        deletedAt: g.deletedAt ?? null,
      };
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
