import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

// 共用資料，依 Cognito 群組授權（群組說明見 auth/resource.ts）：
//   人脈、分組、客戶：admin 與 team 能讀寫
//   待辦：admin、team、todo 能讀寫；待辦選項只有 admin 能寫，team 與 todo 唯讀
//   產品進度：admin、team、tech 能讀寫；產品進度選項只有 admin 能寫，team 與 tech 唯讀
// Amplify 會自動加上 createdAt / updatedAt（伺服器時間），所以 App 自己的時間戳
// 另存為 clientCreatedAt / clientUpdatedAt，同步比對新舊用的是後者。
const schema = a.schema({
  Person: a
    .model({
      displayName: a.string().required(),
      lineName: a.string(),
      avatarPhotoId: a.string(),
      photoIds: a.string().array().required(),
      groupIds: a.string().array().required(),
      occasion: a.string(),
      metDate: a.string(),
      note: a.string(),
      // 合作機會：用字串存，值的範圍由 App 端把關（之後加狀態不用動後端）
      collabStatus: a.string(),
      collabOwner: a.string(),
      collabNote: a.string(),
      clientCreatedAt: a.string().required(),
      clientUpdatedAt: a.string().required(),
      deletedAt: a.string(),
    })
    .authorization((allow) => [allow.groups(['admin', 'team'])]),

  Group: a
    .model({
      name: a.string().required(),
      color: a.string().required(),
      order: a.integer().required(),
      clientUpdatedAt: a.string().required(),
      deletedAt: a.string(),
    })
    .authorization((allow) => [allow.groups(['admin', 'team'])]),

  // 客戶：聯絡中的名單。從人脈記錄標記的有 personId（編號是 client-人物編號，名字讀人物資料），
  // 在客戶頁直接新增的沒有 personId、自己存 name。狀態是 App 端固定的代號，負責人用待辦選項的編號。
  Client: a
    .model({
      personId: a.string(),
      name: a.string(),
      statusId: a.string(),
      ownerId: a.string(),
      dueDate: a.string(),
      note: a.string(),
      done: a.boolean().required(),
      doneAt: a.string(),
      clientCreatedAt: a.string().required(),
      clientUpdatedAt: a.string().required(),
      deletedAt: a.string(),
    })
    .authorization((allow) => [allow.groups(['admin', 'team'])]),

  // 待辦：任務用編號引用選項（分類、負責人、優先級、狀態），改名不用動任務。
  Task: a
    .model({
      name: a.string().required(),
      categoryId: a.string().required(),
      ownerId: a.string(),
      dueDate: a.string(),
      priorityId: a.string(),
      statusId: a.string(),
      note: a.string(),
      createdBy: a.string(),
      done: a.boolean().required(),
      doneAt: a.string(),
      doneBy: a.string(),
      clientCreatedAt: a.string().required(),
      clientUpdatedAt: a.string().required(),
      deletedAt: a.string(),
    })
    .authorization((allow) => [allow.groups(['admin', 'team', 'todo'])]),

  // 產品進度（和技術長溝通的表格）：小項目掛在大項目底下。大項目、營運優先級、技術等級、狀態
  // 都是 ProgressOption 的編號（用字串存），改名、新增不用動任務。
  ProgressItem: a
    .model({
      name: a.string().required(),
      projectId: a.string().required(),
      opsPriority: a.string(),
      techLevel: a.string(),
      status: a.string().required(),
      dueDate: a.string(),
      opsNote: a.string(),
      techNote: a.string(),
      doneAt: a.string(),
      createdBy: a.string(),
      clientCreatedAt: a.string().required(),
      clientUpdatedAt: a.string().required(),
      deletedAt: a.string(),
    })
    .authorization((allow) => [allow.groups(['admin', 'team', 'tech'])]),

  // 待辦的選項清單：team 與 todo 可讀，只有 admin 群組能寫（伺服器強制執行）。
  TaskOption: a
    .model({
      kind: a.string().required(),
      name: a.string().required(),
      order: a.integer().required(),
      email: a.string(),
      clientUpdatedAt: a.string().required(),
      deletedAt: a.string(),
    })
    .authorization((allow) => [allow.group('admin'), allow.groups(['team', 'todo']).to(['read'])]),

  // 產品進度的選項（大項目、營運優先級、技術等級、狀態）：admin 能寫，team 與 tech 唯讀。
  // 用字串存 kind、顏色，值的範圍由 App 端把關。
  ProgressOption: a
    .model({
      kind: a.string().required(),
      name: a.string().required(),
      order: a.integer().required(),
      color: a.string().required(),
      hint: a.string(),
      isDone: a.boolean(),
      clientUpdatedAt: a.string().required(),
      deletedAt: a.string(),
    })
    .authorization((allow) => [allow.group('admin'), allow.groups(['team', 'tech']).to(['read'])]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
  },
});
