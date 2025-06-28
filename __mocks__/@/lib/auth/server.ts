// Changes: requireAuthとgetUserFromSessionのモック関数を追加
// Mock for authentication server
export const getServerSession = jest.fn();
export const requireAuth = jest.fn();
export const getUserFromSession = jest.fn();