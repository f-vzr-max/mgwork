import { invoiceCreateSchema, invoiceUpdateSchema } from "@/lib/validation/invoice";

const CUID = "ckxyz123abc456def789ghijk";

describe("invoiceCreateSchema", () => {
  it("accepts a valid wire-transfer invoice with default currency", () => {
    const r = invoiceCreateSchema.parse({
      enterpriseId: CUID,
      amount: 1500,
      paymentMethod: "WIRE",
    });
    expect(r.currency).toBe("MUR");
    expect(r.paymentMethod).toBe("WIRE");
  });

  it("accepts MGA mobile money", () => {
    const r = invoiceCreateSchema.parse({
      enterpriseId: CUID,
      amount: 50000,
      currency: "MGA",
      paymentMethod: "MOBILE_MONEY",
      reference: "TXN-123",
    });
    expect(r.currency).toBe("MGA");
  });

  it("rejects negative or zero amount", () => {
    expect(() =>
      invoiceCreateSchema.parse({
        enterpriseId: CUID,
        amount: 0,
        paymentMethod: "WIRE",
      }),
    ).toThrow();
    expect(() =>
      invoiceCreateSchema.parse({
        enterpriseId: CUID,
        amount: -50,
        paymentMethod: "WIRE",
      }),
    ).toThrow();
  });

  it("rejects unsupported currency", () => {
    expect(() =>
      invoiceCreateSchema.parse({
        enterpriseId: CUID,
        amount: 100,
        currency: "GBP",
        paymentMethod: "WIRE",
      }),
    ).toThrow();
  });

  it("rejects unsupported payment method", () => {
    expect(() =>
      invoiceCreateSchema.parse({
        enterpriseId: CUID,
        amount: 100,
        paymentMethod: "BITCOIN",
      }),
    ).toThrow();
  });

  it("rejects missing enterpriseId", () => {
    expect(() =>
      invoiceCreateSchema.parse({ amount: 100, paymentMethod: "WIRE" }),
    ).toThrow();
  });

  it("rejects unknown keys", () => {
    expect(() =>
      invoiceCreateSchema.parse({
        enterpriseId: CUID,
        amount: 100,
        paymentMethod: "WIRE",
        bogus: 1,
      }),
    ).toThrow();
  });
});

describe("invoiceUpdateSchema", () => {
  it("accepts an empty object", () => {
    expect(invoiceUpdateSchema.parse({})).toEqual({});
  });

  it("accepts a status transition with paidAt", () => {
    const r = invoiceUpdateSchema.parse({ status: "PAID", paidAt: "2026-05-01" });
    expect(r.status).toBe("PAID");
  });

  it("rejects an unknown status", () => {
    expect(() => invoiceUpdateSchema.parse({ status: "DUNNO" })).toThrow();
  });

  it("rejects unknown keys", () => {
    expect(() => invoiceUpdateSchema.parse({ extra: 1 })).toThrow();
  });
});
