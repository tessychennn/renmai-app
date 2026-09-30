import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { storage } from './storage/resource';

const backend = defineBackend({ auth, data, storage });

const { cfnUserPool, cfnUserPoolClient } = backend.auth.resources.cfnResources;

// 關閉自行註冊：只有管理員（你）在 Cognito 主控台建立的帳號能登入
cfnUserPool.adminCreateUserConfig = {
  allowAdminCreateUserOnly: true,
};

// 主畫面 App 每次被 iOS 收掉重開都要重新登入很煩，登入期限拉到 1 年
cfnUserPoolClient.refreshTokenValidity = 365;
cfnUserPoolClient.tokenValidityUnits = {
  refreshToken: 'days',
};
