import type { Prisma } from "@prisma/client";
import { platformDb } from "@/lib/platform-db";
import { MissingTenantScopeError } from "@/lib/tenant-scope";

type UnknownRecord = Record<string, unknown>;
type TenantPolicy =
  | { kind: "direct" }
  | { kind: "globalRead" }
  | { kind: "shop" }
  | { kind: "child"; relationWhere: (shopId: string) => UnknownRecord }
  | {
      kind: "multi";
      accessWhere: (shopId: string) => UnknownRecord;
      createOwnerField: string;
      immutableFields: string[];
    };

const directTenantModels = new Set([
  "User",
  "Category",
  "AttributeTemplate",
  "Product",
  "Customer",
  "Order",
  "MediaAsset",
  "BuyerCartItem",
  "Coupon",
  "DeliveryZone",
  "ReturnRequest",
  "InviteToken",
  "ProductReview",
  "SaleHold",
  "Notification",
  "Debt",
  "DebtPayment",
  "DailyClosing",
  "CustomerMessage",
  "CustomerThread",
  "DesignJob",
  "DesignJobVersion",
  "DesignProductionBrief",
  "HeatPressRun",
  "HeatPressEvent",
  "HeatPressEvidence",
  "CustomerProductionRequest",
  "CustomerProductionAsset",
  "CustomerProductionEvent",
  "PaymentRefund",
  "ProductionInventoryItem",
  "ProductionInventoryMovement",
  "ProductionPurchaseLink",
  "SupplierGoodsReceipt",
  "SupplierCostRecord",
  "SupplierAccountEntry",
  "SupplierStockReturn",
  "ProductionCostSnapshot",
  "ShopMachineProfile",
  "Supplier",
  "SupplierOrder",
  "ShopPaymentConfig",
  "ShopLocation",
  "AuditLog",
]);

const childTenantPolicies: Partial<Record<string, (shopId: string) => UnknownRecord>> = {
  AttributeField: (shopId) => ({ template: { shopId } }),
  ProductVariant: (shopId) => ({ product: { shopId } }),
  OrderItem: (shopId) => ({ order: { shopId } }),
  Payment: (shopId) => ({ order: { shopId } }),
  DebtInstallment: (shopId) => ({ debt: { shopId } }),
  ChatMessage: (shopId) => ({ thread: { shopId } }),
  SupplierOrderItem: (shopId) => ({ supplierOrder: { shopId } }),
  AnnouncementDismissal: (shopId) => ({ user: { shopId } }),
  ShopNetworkOrderItem: (shopId) => ({
    networkOrder: { OR: [{ requesterShopId: shopId }, { partnerShopId: shopId }] },
  }),
};

const modelPropertyNames: Record<string, string> = {
  shop: "Shop",
  user: "User",
  category: "Category",
  attributeTemplate: "AttributeTemplate",
  attributeField: "AttributeField",
  product: "Product",
  productVariant: "ProductVariant",
  customer: "Customer",
  buyerAccount: "BuyerAccount",
  buyerEmailVerification: "BuyerEmailVerification",
  accountTwoFactor: "AccountTwoFactor",
  platformGovernanceSettings: "PlatformGovernanceSettings",
  subscriptionPlan: "SubscriptionPlan",
  subscriptionPlanVersion: "SubscriptionPlanVersion",
  subscriptionPlanChangeRequest: "SubscriptionPlanChangeRequest",
  shopSubscriptionContract: "ShopSubscriptionContract",
  communicationCreditPackage: "CommunicationCreditPackage",
  communicationCreditPackageVersion: "CommunicationCreditPackageVersion",
  communicationCreditPackageChangeRequest: "CommunicationCreditPackageChangeRequest",
  shopCommunicationWallet: "ShopCommunicationWallet",
  communicationCreditPurchase: "CommunicationCreditPurchase",
  communicationCreditLedgerEntry: "CommunicationCreditLedgerEntry",
  supportCase: "SupportCase",
  supportCaseNote: "SupportCaseNote",
  businessApplication: "BusinessApplication",
  order: "Order",
  orderItem: "OrderItem",
  payment: "Payment",
  paymentRefund: "PaymentRefund",
  mediaAsset: "MediaAsset",
  buyerCartItem: "BuyerCartItem",
  coupon: "Coupon",
  deliveryZone: "DeliveryZone",
  returnRequest: "ReturnRequest",
  paymentProviderEvent: "PaymentProviderEvent",
  rateLimitBucket: "RateLimitBucket",
  inviteToken: "InviteToken",
  passwordResetToken: "PasswordResetToken",
  phoneVerificationCode: "PhoneVerificationCode",
  productReview: "ProductReview",
  announcement: "Announcement",
  announcementDismissal: "AnnouncementDismissal",
  saleHold: "SaleHold",
  notification: "Notification",
  debt: "Debt",
  debtInstallment: "DebtInstallment",
  debtPayment: "DebtPayment",
  dailyClosing: "DailyClosing",
  customerMessage: "CustomerMessage",
  customerThread: "CustomerThread",
  chatMessage: "ChatMessage",
  designJob: "DesignJob",
  designJobVersion: "DesignJobVersion",
  designProductionBrief: "DesignProductionBrief",
  heatPressRun: "HeatPressRun",
  heatPressEvent: "HeatPressEvent",
  heatPressEvidence: "HeatPressEvidence",
  customerProductionRequest: "CustomerProductionRequest",
  customerProductionAsset: "CustomerProductionAsset",
  customerProductionEvent: "CustomerProductionEvent",
  productionInventoryItem: "ProductionInventoryItem",
  productionInventoryMovement: "ProductionInventoryMovement",
  productionPurchaseLink: "ProductionPurchaseLink",
  supplierGoodsReceipt: "SupplierGoodsReceipt",
  supplierCostRecord: "SupplierCostRecord",
  supplierAccountEntry: "SupplierAccountEntry",
  supplierStockReturn: "SupplierStockReturn",
  productionCostSnapshot: "ProductionCostSnapshot",
  shopMachineProfile: "ShopMachineProfile",
  supplier: "Supplier",
  supplierOrder: "SupplierOrder",
  supplierOrderItem: "SupplierOrderItem",
  shopNetworkLink: "ShopNetworkLink",
  shopNetworkOrder: "ShopNetworkOrder",
  shopNetworkOrderItem: "ShopNetworkOrderItem",
  shopPaymentConfig: "ShopPaymentConfig",
  shopLocation: "ShopLocation",
  auditLog: "AuditLog",
};

const readOperations = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
]);
const createOperations = new Set(["create", "createMany", "createManyAndReturn"]);
const updateOperations = new Set(["update", "updateMany", "updateManyAndReturn"]);
const deleteOperations = new Set(["delete", "deleteMany"]);
const uniqueWhereOperations = new Set(["findUnique", "findUniqueOrThrow", "update", "delete", "upsert"]);
const blockedClientMethods = new Set([
  "$queryRaw",
  "$queryRawUnsafe",
  "$executeRaw",
  "$executeRawUnsafe",
  "$runCommandRaw",
  "$extends",
  "$connect",
  "$disconnect",
  "$on",
  "$use",
]);

export class TenantDatabaseAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TenantDatabaseAccessError";
  }
}

export class TenantScopeMismatchError extends TenantDatabaseAccessError {
  constructor(model: string) {
    super(`The ${model} operation attempted to use a different shop scope.`);
    this.name = "TenantScopeMismatchError";
  }
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireShopId(shopId: string) {
  const normalized = shopId.trim();
  if (!normalized) throw new MissingTenantScopeError();
  return normalized;
}

function policyFor(model: string): TenantPolicy {
  if (model === "Shop") return { kind: "shop" };
  if (model === "Announcement") return { kind: "globalRead" };
  if (model === "ShopNetworkLink") {
    return {
      kind: "multi",
      accessWhere: (shopId) => ({ OR: [{ requesterShopId: shopId }, { partnerShopId: shopId }] }),
      createOwnerField: "requesterShopId",
      immutableFields: ["requesterShopId", "partnerShopId"],
    };
  }
  if (model === "ShopNetworkOrder") {
    return {
      kind: "multi",
      accessWhere: (shopId) => ({ OR: [{ requesterShopId: shopId }, { partnerShopId: shopId }] }),
      createOwnerField: "requesterShopId",
      immutableFields: ["requesterShopId", "partnerShopId"],
    };
  }
  if (directTenantModels.has(model)) return { kind: "direct" };
  const relationWhere = childTenantPolicies[model];
  if (relationWhere) return { kind: "child", relationWhere };
  throw new TenantDatabaseAccessError(
    `${model} is platform-global or has an unsupported ownership rule. Use the explicitly reviewed platform client or a dedicated repository.`,
  );
}

function combineWhere(where: UnknownRecord, ownershipWhere: UnknownRecord, preserveUniqueShape: boolean) {
  if (!preserveUniqueShape) return { AND: [where, ownershipWhere] };
  const existingAnd = where.AND;
  const topLevelWhere = { ...where };
  delete topLevelWhere.AND;
  const existingConditions = Array.isArray(existingAnd)
    ? existingAnd
    : existingAnd === undefined
      ? []
      : [existingAnd];
  return { ...topLevelWhere, AND: [...existingConditions, ownershipWhere] };
}

function scopeWhere(
  model: string,
  policy: TenantPolicy,
  whereValue: unknown,
  shopId: string,
  allowGlobalRead = false,
  preserveUniqueShape = false,
) {
  const where = isRecord(whereValue) ? whereValue : {};
  if (policy.kind === "direct") {
    if (typeof where.shopId === "string" && where.shopId !== shopId) throw new TenantScopeMismatchError(model);
    return combineWhere(where, { shopId }, preserveUniqueShape);
  }
  if (policy.kind === "globalRead") {
    if (typeof where.shopId === "string" && where.shopId !== shopId) throw new TenantScopeMismatchError(model);
    const ownershipWhere = allowGlobalRead ? { OR: [{ shopId }, { isGlobal: true }] } : { shopId };
    return combineWhere(where, ownershipWhere, preserveUniqueShape);
  }
  if (policy.kind === "shop") {
    if (typeof where.id === "string" && where.id !== shopId) throw new TenantScopeMismatchError(model);
    return combineWhere(where, { id: shopId }, preserveUniqueShape);
  }
  if (policy.kind === "multi") return combineWhere(where, policy.accessWhere(shopId), preserveUniqueShape);
  return combineWhere(where, policy.relationWhere(shopId), preserveUniqueShape);
}

function scopeDirectData(model: string, dataValue: unknown, shopId: string) {
  if (!isRecord(dataValue)) throw new TenantDatabaseAccessError(`${model} data must be an object.`);
  if (typeof dataValue.shopId === "string" && dataValue.shopId !== shopId) throw new TenantScopeMismatchError(model);
  return { ...dataValue, shopId };
}

function scopeMultiData(model: string, policy: Extract<TenantPolicy, { kind: "multi" }>, dataValue: unknown, shopId: string) {
  if (!isRecord(dataValue)) throw new TenantDatabaseAccessError(`${model} data must be an object.`);
  const ownerValue = dataValue[policy.createOwnerField];
  if (typeof ownerValue === "string" && ownerValue !== shopId) throw new TenantScopeMismatchError(model);
  return { ...dataValue, [policy.createOwnerField]: shopId };
}

function protectUpdateData(model: string, policy: TenantPolicy, dataValue: unknown, shopId: string) {
  if (!isRecord(dataValue)) return dataValue;
  if (policy.kind === "direct" || policy.kind === "globalRead") {
    if (Object.hasOwn(dataValue, "shopId") && dataValue.shopId !== shopId) {
      throw new TenantScopeMismatchError(model);
    }
    return { ...dataValue, ...(Object.hasOwn(dataValue, "shopId") ? { shopId } : {}) };
  }
  if (policy.kind === "shop" && Object.hasOwn(dataValue, "id")) {
    throw new TenantDatabaseAccessError("Tenant code cannot change a shop primary key.");
  }
  if (policy.kind === "multi" && policy.immutableFields.some((field) => Object.hasOwn(dataValue, field))) {
    throw new TenantDatabaseAccessError(`${model} ownership fields cannot be changed by tenant code.`);
  }
  return dataValue;
}

async function assertChildCreate(model: string, dataValue: unknown, shopId: string) {
  if (!isRecord(dataValue)) throw new TenantDatabaseAccessError(`${model} data must be an object.`);

  let belongs = false;
  switch (model) {
    case "AttributeField":
      belongs = typeof dataValue.templateId === "string" && await platformDb.attributeTemplate.count({ where: { id: dataValue.templateId, shopId } }) === 1;
      break;
    case "ProductVariant":
      belongs = typeof dataValue.productId === "string" && await platformDb.product.count({ where: { id: dataValue.productId, shopId } }) === 1;
      break;
    case "OrderItem":
      belongs = typeof dataValue.orderId === "string" && await platformDb.order.count({ where: { id: dataValue.orderId, shopId } }) === 1;
      break;
    case "Payment":
      belongs = typeof dataValue.orderId === "string" && await platformDb.order.count({ where: { id: dataValue.orderId, shopId } }) === 1;
      break;
    case "DebtInstallment":
      belongs = typeof dataValue.debtId === "string" && await platformDb.debt.count({ where: { id: dataValue.debtId, shopId } }) === 1;
      break;
    case "ChatMessage":
      belongs = typeof dataValue.threadId === "string" && await platformDb.customerThread.count({ where: { id: dataValue.threadId, shopId } }) === 1;
      break;
    case "SupplierOrderItem":
      belongs = typeof dataValue.supplierOrderId === "string" && await platformDb.supplierOrder.count({ where: { id: dataValue.supplierOrderId, shopId } }) === 1;
      break;
    case "AnnouncementDismissal":
      belongs = typeof dataValue.userId === "string" && await platformDb.user.count({ where: { id: dataValue.userId, shopId } }) === 1;
      break;
    case "ShopNetworkOrderItem":
      belongs = typeof dataValue.networkOrderId === "string" && await platformDb.shopNetworkOrder.count({
        where: {
          id: dataValue.networkOrderId,
          OR: [{ requesterShopId: shopId }, { partnerShopId: shopId }],
        },
      }) === 1;
      break;
    default:
      belongs = false;
  }

  if (!belongs) throw new TenantScopeMismatchError(model);
  return dataValue;
}

async function scopeCreateData(model: string, policy: TenantPolicy, dataValue: unknown, shopId: string) {
  if (policy.kind === "shop") throw new TenantDatabaseAccessError("Tenant code cannot create shops.");
  if (policy.kind === "direct" || policy.kind === "globalRead") return scopeDirectData(model, dataValue, shopId);
  if (policy.kind === "multi") return scopeMultiData(model, policy, dataValue, shopId);
  return assertChildCreate(model, dataValue, shopId);
}

async function scopeCreatePayload(model: string, policy: TenantPolicy, dataValue: unknown, shopId: string) {
  if (Array.isArray(dataValue)) return Promise.all(dataValue.map((item) => scopeCreateData(model, policy, item, shopId)));
  return scopeCreateData(model, policy, dataValue, shopId);
}

async function scopeOperationArguments(model: string, operation: string, argsValue: unknown, shopId: string) {
  const policy = policyFor(model);
  const scopedArgs: UnknownRecord = isRecord(argsValue) ? { ...argsValue } : {};
  const preserveUniqueShape = uniqueWhereOperations.has(operation);

  if (readOperations.has(operation)) {
    scopedArgs.where = scopeWhere(model, policy, scopedArgs.where, shopId, true, preserveUniqueShape);
  } else if (createOperations.has(operation)) {
    scopedArgs.data = await scopeCreatePayload(model, policy, scopedArgs.data, shopId);
  } else if (updateOperations.has(operation)) {
    scopedArgs.where = scopeWhere(model, policy, scopedArgs.where, shopId, false, preserveUniqueShape);
    scopedArgs.data = protectUpdateData(model, policy, scopedArgs.data, shopId);
  } else if (deleteOperations.has(operation)) {
    scopedArgs.where = scopeWhere(model, policy, scopedArgs.where, shopId, false, preserveUniqueShape);
  } else if (operation === "upsert") {
    scopedArgs.where = scopeWhere(model, policy, scopedArgs.where, shopId, false, preserveUniqueShape);
    scopedArgs.create = await scopeCreateData(model, policy, scopedArgs.create, shopId);
    scopedArgs.update = protectUpdateData(model, policy, scopedArgs.update, shopId);
  } else {
    throw new TenantDatabaseAccessError(`${model}.${operation} is not allowed through the tenant client.`);
  }

  return scopedArgs;
}

function looksLikePrismaDelegate(value: unknown) {
  if (typeof value !== "object" || value === null) return false;
  return ["findUnique", "findFirst", "findMany", "create", "update", "delete"].some(
    (operation) => typeof Reflect.get(value, operation) === "function",
  );
}

function blockedUnknownDelegate(property: string, delegate: object) {
  return new Proxy(delegate, {
    get(delegateTarget, operation, delegateReceiver) {
      const method = Reflect.get(delegateTarget, operation, delegateReceiver);
      if (typeof operation !== "string" || typeof method !== "function") return method;
      return () => {
        throw new TenantDatabaseAccessError(`${property}.${operation} is not registered for tenant access.`);
      };
    },
  });
}

function createTenantTransactionDb(transaction: Prisma.TransactionClient, shopId: string) {
  return new Proxy(transaction, {
    get(target, property, receiver) {
      if (typeof property !== "string") return Reflect.get(target, property, receiver);
      if (blockedClientMethods.has(property) || property === "$transaction") {
        return () => {
          throw new TenantDatabaseAccessError(`${property} is not allowed inside a tenant transaction.`);
        };
      }

      const delegate = Reflect.get(target, property, target);
      const model = modelPropertyNames[property];
      if (!model) return looksLikePrismaDelegate(delegate) ? blockedUnknownDelegate(property, delegate) : Reflect.get(target, property, receiver);
      if (typeof delegate !== "object" || delegate === null) return delegate;

      return new Proxy(delegate, {
        get(delegateTarget, operation, delegateReceiver) {
          const method = Reflect.get(delegateTarget, operation, delegateReceiver);
          if (typeof operation !== "string" || typeof method !== "function") return method;
          return async (...input: unknown[]) => {
            const scopedArgs = await scopeOperationArguments(model, operation, input[0], shopId);
            return Reflect.apply(method, delegateTarget, [scopedArgs, ...input.slice(1)]);
          };
        },
      });
    },
  }) as Prisma.TransactionClient;
}

export function createTenantDb(shopIdValue: string) {
  const shopId = requireShopId(shopIdValue);
  const tenantClient = platformDb.$extends({
    name: `tenant-scope:${shopId}`,
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const scopedArgs = await scopeOperationArguments(model, operation, args, shopId);
          return query(scopedArgs as typeof args);
        },
      },
    },
  });

  return new Proxy(tenantClient, {
    get(target, property, receiver) {
      if (property === "$transaction") {
        return (input: unknown, options?: unknown) => {
          if (typeof input === "function") {
            const callback = input as (transaction: Prisma.TransactionClient) => Promise<unknown> | unknown;
            return platformDb.$transaction(
              async (transaction) => callback(createTenantTransactionDb(transaction, shopId)),
              options as never,
            );
          }
          const transactionMethod = Reflect.get(target, property, target);
          return Reflect.apply(transactionMethod, target, options === undefined ? [input] : [input, options]);
        };
      }
      if (typeof property === "string" && blockedClientMethods.has(property)) {
        return () => {
          throw new TenantDatabaseAccessError(`${property} is not allowed through the tenant client.`);
        };
      }
      return Reflect.get(target, property, receiver);
    },
  });
}

export type TenantDb = ReturnType<typeof createTenantDb>;

export const tenantScopedModelNames = Object.freeze([
  "Shop",
  "Announcement",
  "ShopNetworkLink",
  "ShopNetworkOrder",
  ...directTenantModels,
  ...Object.keys(childTenantPolicies),
]);
