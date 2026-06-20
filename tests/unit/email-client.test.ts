import { send } from "@/lib/email/client";

const ENDPOINT = "https://api.brevo.com/v3/smtp/email";
const realFetch = global.fetch;
const fetchMock = jest.fn();

describe("email send (Brevo transport)", () => {
  beforeEach(() => {
    global.fetch = fetchMock as unknown as typeof fetch;
    jest.spyOn(console, "log").mockImplementation(() => {});
  });
  afterEach(() => {
    global.fetch = realFetch;
    delete process.env.BREVO_API_KEY;
    delete process.env.BREVO_FROM_EMAIL;
    jest.restoreAllMocks();
  });

  it("no-ops without an API key and never calls fetch", async () => {
    delete process.env.BREVO_API_KEY;
    const res = await send({ template: "welcome", to: "a@b.com", props: {} });
    expect(res).toEqual({ error: "no-key", logged: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts a Brevo payload with parsed sender and returns the messageId", async () => {
    process.env.BREVO_API_KEY = "key_123";
    process.env.BREVO_FROM_EMAIL = "AsanaoConnect <noreply@mgwork.io>";
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ messageId: "msg_1" }) });

    const res = await send({ template: "welcome", to: "x@y.com", props: {}, subject: "Hi" });

    expect(res).toEqual({ id: "msg_1" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [
      string,
      { headers: Record<string, string>; body: string },
    ];
    expect(url).toBe(ENDPOINT);
    expect(init.headers["api-key"]).toBe("key_123");
    const body = JSON.parse(init.body) as {
      sender: unknown;
      to: unknown;
      subject: unknown;
      htmlContent: unknown;
    };
    expect(body.sender).toEqual({ name: "AsanaoConnect", email: "noreply@mgwork.io" });
    expect(body.to).toEqual([{ email: "x@y.com" }]);
    expect(body.subject).toBe("Hi");
    expect(typeof body.htmlContent).toBe("string");
  });

  it("maps a non-ok Brevo response to a send-error", async () => {
    process.env.BREVO_API_KEY = "key_123";
    fetchMock.mockResolvedValue({ ok: false, status: 401, text: async () => "nope" });
    const res = await send({ template: "welcome", to: "x@y.com", props: {} });
    expect(res).toMatchObject({ error: "send-error" });
  });
});
