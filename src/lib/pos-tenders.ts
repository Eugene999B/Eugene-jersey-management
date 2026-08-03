export const POS_TENDER_METHODS = ["CASH", "CARD", "MOMO", "STORE_CREDIT"] as const;

export type PosTenderMethod = (typeof POS_TENDER_METHODS)[number];

export type PosTenderInput = {
  method: PosTenderMethod;
  amount: number;
  tenderedAmount?: number;
  reference?: string;
  confirmed?: boolean;
};

export type NormalizedPosTender = {
  method: PosTenderMethod;
  amount: number;
  amountMinor: number;
  tenderedAmount: number | null;
  tenderedMinor: number | null;
  changeAmount: number;
  changeMinor: number;
  reference: string | null;
  confirmed: boolean;
};

export type PosTenderPlan = {
  tenders: NormalizedPosTender[];
  totalAmount: number;
  totalMinor: number;
  allocatedAmount: number;
  allocatedMinor: number;
  paidAmount: number;
  paidMinor: number;
  creditAmount: number;
  creditMinor: number;
  cashReceived: number;
  cashReceivedMinor: number;
  changeAmount: number;
  changeMinor: number;
  methods: PosTenderMethod[];
};

export class PosTenderValidationError extends Error {
  constructor(
    public readonly code:
      | "PAYMENT_REQUIRED"
      | "PAYMENT_AMOUNT"
      | "PAYMENT_DUPLICATE_METHOD"
      | "PAYMENT_TOTAL_MISMATCH"
      | "CASH_RECEIVED_LOW"
      | "EXTERNAL_REFERENCE_REQUIRED"
      | "EXTERNAL_CONFIRMATION_REQUIRED"
      | "EXTERNAL_REFERENCE_DUPLICATE",
    message: string,
  ) {
    super(message);
    this.name = "PosTenderValidationError";
  }
}

export function moneyToMinor(value: number) {
  if (!Number.isFinite(value)) return Number.NaN;
  return Math.round((value + Number.EPSILON) * 100);
}

export function minorToMoney(value: number) {
  return Number((value / 100).toFixed(2));
}

export function normalizePosTenders(inputs: readonly PosTenderInput[], totalAmount: number): PosTenderPlan {
  const totalMinor = moneyToMinor(totalAmount);
  if (!Number.isInteger(totalMinor) || totalMinor < 0) {
    throw new PosTenderValidationError("PAYMENT_AMOUNT", "The order total is invalid.");
  }

  if (totalMinor === 0 && inputs.length === 0) {
    return {
      tenders: [],
      totalAmount: 0,
      totalMinor: 0,
      allocatedAmount: 0,
      allocatedMinor: 0,
      paidAmount: 0,
      paidMinor: 0,
      creditAmount: 0,
      creditMinor: 0,
      cashReceived: 0,
      cashReceivedMinor: 0,
      changeAmount: 0,
      changeMinor: 0,
      methods: [],
    };
  }

  if (!inputs.length) {
    throw new PosTenderValidationError("PAYMENT_REQUIRED", "Add at least one payment method.");
  }

  const seenMethods = new Set<PosTenderMethod>();
  const seenReferences = new Set<string>();
  const tenders = inputs.map((input) => {
    if (seenMethods.has(input.method)) {
      throw new PosTenderValidationError("PAYMENT_DUPLICATE_METHOD", `${input.method} can only appear once in a payment breakdown.`);
    }
    seenMethods.add(input.method);

    const amountMinor = moneyToMinor(input.amount);
    if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
      throw new PosTenderValidationError("PAYMENT_AMOUNT", `Enter a valid amount for ${input.method}.`);
    }

    let tenderedMinor: number | null = null;
    let changeMinor = 0;
    let reference: string | null = null;
    const confirmed = input.confirmed === true;

    if (input.method === "CASH") {
      tenderedMinor = moneyToMinor(input.tenderedAmount ?? input.amount);
      if (!Number.isInteger(tenderedMinor) || tenderedMinor < amountMinor) {
        throw new PosTenderValidationError("CASH_RECEIVED_LOW", "Cash received cannot be less than the cash allocation.");
      }
      changeMinor = tenderedMinor - amountMinor;
    }

    if (input.method === "CARD" || input.method === "MOMO") {
      reference = input.reference?.trim() || null;
      if (!reference || reference.length < 3) {
        throw new PosTenderValidationError("EXTERNAL_REFERENCE_REQUIRED", `Enter the ${input.method === "CARD" ? "terminal" : "mobile-money"} reference.`);
      }
      if (!confirmed) {
        throw new PosTenderValidationError("EXTERNAL_CONFIRMATION_REQUIRED", `Confirm that the ${input.method === "CARD" ? "card" : "mobile-money"} payment was received.`);
      }
      const referenceKey = reference.toLocaleLowerCase();
      if (seenReferences.has(referenceKey)) {
        throw new PosTenderValidationError("EXTERNAL_REFERENCE_DUPLICATE", "Each external payment must use a different reference.");
      }
      seenReferences.add(referenceKey);
    }

    return {
      method: input.method,
      amount: minorToMoney(amountMinor),
      amountMinor,
      tenderedAmount: tenderedMinor === null ? null : minorToMoney(tenderedMinor),
      tenderedMinor,
      changeAmount: minorToMoney(changeMinor),
      changeMinor,
      reference,
      confirmed,
    };
  });

  const allocatedMinor = tenders.reduce((sum, tender) => sum + tender.amountMinor, 0);
  if (allocatedMinor !== totalMinor) {
    const difference = minorToMoney(Math.abs(totalMinor - allocatedMinor));
    throw new PosTenderValidationError(
      "PAYMENT_TOTAL_MISMATCH",
      allocatedMinor < totalMinor
        ? `Allocate the remaining ${difference.toFixed(2)} before checkout.`
        : `Payment allocations exceed the order total by ${difference.toFixed(2)}.`,
    );
  }

  const creditMinor = tenders
    .filter((tender) => tender.method === "STORE_CREDIT")
    .reduce((sum, tender) => sum + tender.amountMinor, 0);
  const paidMinor = totalMinor - creditMinor;
  const cashReceivedMinor = tenders
    .filter((tender) => tender.method === "CASH")
    .reduce((sum, tender) => sum + (tender.tenderedMinor ?? 0), 0);
  const changeMinor = tenders.reduce((sum, tender) => sum + tender.changeMinor, 0);

  return {
    tenders,
    totalAmount: minorToMoney(totalMinor),
    totalMinor,
    allocatedAmount: minorToMoney(allocatedMinor),
    allocatedMinor,
    paidAmount: minorToMoney(paidMinor),
    paidMinor,
    creditAmount: minorToMoney(creditMinor),
    creditMinor,
    cashReceived: minorToMoney(cashReceivedMinor),
    cashReceivedMinor,
    changeAmount: minorToMoney(changeMinor),
    changeMinor,
    methods: tenders.map((tender) => tender.method),
  };
}

export function posTenderError(error: unknown) {
  return error instanceof PosTenderValidationError ? error : null;
}
