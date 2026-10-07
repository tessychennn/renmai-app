import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

// 兩個人共用同一份資料：任何登入的帳號都能讀寫全部（帳號池只有管理員建立的兩個人）。
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
    .authorization((allow) => [allow.authenticated()]),

  Group: a
    .model({
      name: a.string().required(),
      color: a.string().required(),
      order: a.integer().required(),
      clientUpdatedAt: a.string().required(),
      deletedAt: a.string(),
    })
    .authorization((allow) => [allow.authenticated()]),

  // 待辦：任務用編號引用選項（分類、負責人、優先級、狀態），改名不用動任務。
  // 所有登入的人都能新增、修改、完成、刪除任務。
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
    .authorization((allow) => [allow.authenticated()]),

  // 待辦的選項清單：所有人可讀，只有 admin 群組能寫（伺服器強制執行）。
  TaskOption: a
    .model({
      kind: a.string().required(),
      name: a.string().required(),
      order: a.integer().required(),
      email: a.string(),
      clientUpdatedAt: a.string().required(),
      deletedAt: a.string(),
    })
    .authorization((allow) => [allow.group('admin'), allow.authenticated().to(['read'])]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
  },
});
