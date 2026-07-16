import { describe, it, expect } from "vitest";
import { commentNotification, invitation, welcome } from "./templates";

describe("email templates", () => {
  it("commentNotification includes commenter, body and a link to the mockup", () => {
    const t = commentNotification({
      recipientName: "Ravi",
      commenterName: "Jane",
      mockupName: "Homepage",
      body: "Fix the header",
      mockupId: "m123",
    });
    expect(t.subject).toContain("Homepage");
    expect(t.html).toContain("Jane");
    expect(t.html).toContain("Fix the header");
    expect(t.html).toContain("/app/mockups/m123");
    expect(t.text).toContain("Fix the header");
  });

  it("invitation varies the link by new vs existing user", () => {
    const neu = invitation({ inviterName: "Ravi", workspaceName: "Apexure", isNewUser: true });
    const old = invitation({ inviterName: "Ravi", workspaceName: "Apexure", isNewUser: false });
    expect(neu.html).toContain("/signup");
    expect(old.html).toContain("/login");
    expect(neu.subject).toContain("Apexure");
  });

  it("welcome greets the user by name", () => {
    const t = welcome({ name: "Ravi" });
    expect(t.html).toContain("Ravi");
    expect(t.subject.toLowerCase()).toContain("welcome");
  });

  it("escapes HTML in names/subjects to prevent injection", () => {
    const t = commentNotification({ recipientName: "R", commenterName: "J", mockupName: '<img src=x onerror=alert(1)>', body: "hi", mockupId: "m1" });
    expect(t.html).not.toContain("<img src=x");
    expect(t.html).toContain("&lt;img");
    const inv = invitation({ inviterName: '<script>bad</script>', workspaceName: "W", isNewUser: true });
    expect(inv.html).not.toContain("<script>bad");
  });
});
