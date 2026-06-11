// Unit tests for lib/social/meta-adapter.ts — per-product webhook
// normalisation + dispatch (channels phase 0). Pure fixture-driven: the
// normalisers never touch env, so no mocks are needed (sends are not tested
// here — stub mode would skip them anyway).

import {
  instagramAdapter,
  messengerAdapter,
  metaAdapterFor,
  whatsappAdapter,
} from "@/lib/social/meta-adapter";

function whatsappPayload(messages: unknown[]): unknown {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "waba-1",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { phone_number_id: "phone-1" },
              messages,
            },
          },
        ],
      },
    ],
  };
}

function pagePayload(messaging: unknown[]): unknown {
  return {
    object: "page",
    entry: [{ id: "page-1", messaging }],
  };
}

describe("metaAdapterFor (object-field dispatch)", () => {
  it("routes each Meta product to its adapter", () => {
    expect(metaAdapterFor("whatsapp_business_account")).toBe(whatsappAdapter);
    expect(metaAdapterFor("page")).toBe(messengerAdapter);
    expect(metaAdapterFor("instagram")).toBe(instagramAdapter);
  });

  it("returns null for unknown products", () => {
    expect(metaAdapterFor("permissions")).toBeNull();
    expect(metaAdapterFor("")).toBeNull();
  });
});

describe("WhatsAppAdapter.receiveAll", () => {
  it("returns EVERY user-authored text message in the batch", async () => {
    const out = await whatsappAdapter.receiveAll(
      whatsappPayload([
        { from: "26134000111", id: "wamid.1", timestamp: "1", type: "text", text: { body: "Salama" } },
        { from: "26134000222", id: "wamid.2", timestamp: "2", type: "text", text: { body: "Bonjour" } },
        { from: "26134000333", id: "wamid.3", timestamp: "3", type: "image" },
      ]),
    );
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({
      platform: "WHATSAPP",
      threadId: "phone-1",
      externalId: "wamid.1",
      senderId: "26134000111",
      text: "Salama",
    });
    expect(out[1].externalId).toBe("wamid.2");
  });

  it("skips status-only payloads and malformed roots", async () => {
    const statusesOnly = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "waba-1",
          changes: [{ field: "messages", value: { statuses: [{ id: "wamid.9" }] } }],
        },
      ],
    };
    expect(await whatsappAdapter.receiveAll(statusesOnly)).toHaveLength(0);
    expect(await whatsappAdapter.receiveAll({ bogus: true })).toHaveLength(0);
    expect(await whatsappAdapter.receiveAll(null)).toHaveLength(0);
  });
});

describe("MessengerAdapter.receiveAll", () => {
  it("normalises text messages and skips page echoes", async () => {
    const out = await messengerAdapter.receiveAll(
      pagePayload([
        {
          sender: { id: "psid-1" },
          recipient: { id: "page-1" },
          timestamp: 100,
          message: { mid: "mid.1", text: "Hello" },
        },
        {
          sender: { id: "page-1" },
          recipient: { id: "psid-1" },
          timestamp: 101,
          message: { mid: "mid.2", text: "Echo", is_echo: true },
        },
      ]),
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      platform: "MESSENGER",
      threadId: "page-1",
      externalId: "mid.1",
      senderId: "psid-1",
      text: "Hello",
    });
  });

  it("yields a referral-only event (m.me link tap) with empty text + referralRef", async () => {
    const out = await messengerAdapter.receiveAll(
      pagePayload([
        {
          sender: { id: "psid-2" },
          recipient: { id: "page-1" },
          timestamp: 200,
          referral: { ref: "ABC23456", source: "SHORTLINK", type: "OPEN_THREAD" },
        },
      ]),
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      platform: "MESSENGER",
      senderId: "psid-2",
      text: "",
      referralRef: "ABC23456",
    });
    // Synthesized idempotency id — stable across Meta retries of the delivery.
    expect(out[0].externalId).toBe("ref:page-1:psid-2:200");
  });

  it("a referral WITHOUT timestamp gets a per-event id (later taps are not deduped forever)", async () => {
    const tap = () =>
      pagePayload([
        {
          sender: { id: "psid-2" },
          recipient: { id: "page-1" },
          referral: { ref: "ABC23456", source: "SHORTLINK", type: "OPEN_THREAD" },
        },
      ]);
    const [first] = await messengerAdapter.receiveAll(tap());
    await new Promise((r) => setTimeout(r, 5));
    const [second] = await messengerAdapter.receiveAll(tap());
    expect(first.externalId).toMatch(/^ref:page-1:psid-2:\d+$/);
    expect(first.externalId).not.toBe(second.externalId);
  });

  it("a malformed sibling never sinks the batch", async () => {
    const out = await messengerAdapter.receiveAll(
      pagePayload([
        { not: "a messaging item" },
        {
          sender: { id: "psid-3" },
          message: { mid: "mid.3", text: "Still here" },
        },
      ]),
    );
    expect(out).toHaveLength(1);
    expect(out[0].text).toBe("Still here");
  });

  it("instagram payloads normalise to the INSTAGRAM platform", async () => {
    const out = await instagramAdapter.receiveAll({
      object: "instagram",
      entry: [
        {
          id: "ig-1",
          messaging: [{ sender: { id: "igsid-1" }, message: { mid: "mid.ig", text: "Hi" } }],
        },
      ],
    });
    expect(out).toHaveLength(1);
    expect(out[0].platform).toBe("INSTAGRAM");
  });
});
