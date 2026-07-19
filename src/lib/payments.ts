type PaystackInitInput = {
  email: string;
  amount: number;
  currency: string;
  reference: string;
  callbackUrl: string;
  metadata?: Record<string, unknown>;
};

type PaystackInitResult = {
  authorizationUrl: string | null;
  reference: string;
  providerEnabled: boolean;
};

function amountToSubunit(amount: number) {
  return Math.round(amount * 100);
}

export async function initializePaystackTransaction(input: PaystackInitInput): Promise<PaystackInitResult> {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    return {
      authorizationUrl: null,
      reference: input.reference,
      providerEnabled: false,
    };
  }

  const response = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: input.email,
      amount: amountToSubunit(input.amount),
      currency: input.currency,
      reference: input.reference,
      callback_url: input.callbackUrl,
      metadata: input.metadata,
    }),
  });

  const payload = await response.json() as {
    status?: boolean;
    message?: string;
    data?: { authorization_url?: string; reference?: string };
  };

  if (!response.ok || !payload.status || !payload.data?.authorization_url) {
    throw new Error(payload.message ?? "Paystack transaction initialization failed.");
  }

  return {
    authorizationUrl: payload.data.authorization_url,
    reference: payload.data.reference ?? input.reference,
    providerEnabled: true,
  };
}
