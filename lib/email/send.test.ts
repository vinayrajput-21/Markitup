import { describe, it, expect, vi } from "vitest";

const sendMock = vi.fn();
vi.mock("./client", () => ({
  getResend: () => ({ emails: { send: sendMock } }),
}));

describe("sendEmail", () => {
  // Reset is inlined per-test (rather than in a beforeEach hook) to sidestep a
  // Vitest 4.1.10 tinyspy quirk: resetting a mock from a `beforeEach` hook
  // before a test that uses `mockRejectedValue` causes Vitest to misattribute
  // a phantom "unhandled rejection" failure to that test, even though the
  // rejection is correctly caught by sendEmail's try/catch (verified via
  // manual instrumentation: sendEmail resolves { ok: false } and the
  // assertion below passes). Reset must still run before each test so the
  // two tests don't share mock configuration.

  it("sends via Resend with the configured from address", async () => {
    sendMock.mockReset();
    sendMock.mockResolvedValue({ error: null });
    const { sendEmail, EMAIL_FROM } = await import("./send");
    const res = await sendEmail({ to: "a@b.com", subject: "Hi", html: "<p>Hi</p>", text: "Hi" });
    expect(res.ok).toBe(true);
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({ from: EMAIL_FROM, to: "a@b.com", subject: "Hi" }),
    );
  });

  it("never throws when Resend rejects", async () => {
    sendMock.mockReset();
    sendMock.mockRejectedValue(new Error("network"));
    const { sendEmail } = await import("./send");
    const res = await sendEmail({ to: "a@b.com", subject: "Hi", html: "x", text: "x" });
    expect(res.ok).toBe(false);
  });
});
