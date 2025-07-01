// Mock for @prisma/client

export const PrismaClient = jest.fn(() => ({
  user: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    upsert: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
    groupBy: jest.fn(),
  },
  chat: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    upsert: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
    groupBy: jest.fn(),
  },
  message: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    upsert: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
    groupBy: jest.fn(),
  },
  session: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    upsert: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
    groupBy: jest.fn(),
  },
  $connect: jest.fn(),
  $disconnect: jest.fn(),
  $executeRaw: jest.fn(),
  $executeRawUnsafe: jest.fn(),
  $queryRaw: jest.fn(),
  $queryRawUnsafe: jest.fn(),
  $transaction: jest.fn(),
  $on: jest.fn(),
  $use: jest.fn(),
  $extends: jest.fn(),
}));

export const Prisma = {
  PrismaClientKnownRequestError: class PrismaClientKnownRequestError extends Error {
    constructor(message: string, public code: string, public clientVersion: string, public meta?: any) {
      super(message);
      this.name = 'PrismaClientKnownRequestError';
    }
  },
  PrismaClientUnknownRequestError: class PrismaClientUnknownRequestError extends Error {
    constructor(message: string, public clientVersion: string) {
      super(message);
      this.name = 'PrismaClientUnknownRequestError';
    }
  },
  PrismaClientRustPanicError: class PrismaClientRustPanicError extends Error {
    constructor(message: string, public clientVersion: string) {
      super(message);
      this.name = 'PrismaClientRustPanicError';
    }
  },
  PrismaClientInitializationError: class PrismaClientInitializationError extends Error {
    constructor(message: string, public clientVersion: string) {
      super(message);
      this.name = 'PrismaClientInitializationError';
    }
  },
  PrismaClientValidationError: class PrismaClientValidationError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'PrismaClientValidationError';
    }
  },
  DbNull: Symbol('DbNull'),
  JsonNull: Symbol('JsonNull'),
  AnyNull: Symbol('AnyNull'),
  sql: jest.fn(),
  empty: jest.fn(),
  join: jest.fn(),
  raw: jest.fn(),
  validator: jest.fn(),
  defineExtension: jest.fn(),
  getExtensionContext: jest.fn(),
};

export default {
  PrismaClient,
  Prisma,
};