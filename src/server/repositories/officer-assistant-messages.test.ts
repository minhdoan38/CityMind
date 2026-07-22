import { describe, expect, it, vi } from "vitest";

import {
  insertOfficerAssistantMessage,
  listOfficerAssistantMessages,
} from "./officer-assistant-messages";

function createMockClient() {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({
      data: [
        {
          message_id: "msg-1",
          officer_user_id: "officer-1",
          report_id: "rep-1",
          role: "user",
          content: "Hello",
          created_at: "2026-07-22T00:00:00.000Z",
          model: null,
          latency_ms: null,
        },
      ],
      error: null,
    }),
    insert: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: {
        message_id: "msg-2",
        officer_user_id: "officer-1",
        report_id: "rep-2",
        role: "assistant",
        content: "Reply",
        created_at: "2026-07-22T00:01:00.000Z",
        model: "test-model",
        latency_ms: 42,
      },
      error: null,
    }),
  };

  return {
    from: vi.fn(() => chain),
    chain,
  };
}

describe("officer-assistant-messages repository", () => {
  it("listOfficerAssistantMessages filters by officer_user_id", async () => {
    const mock = createMockClient();
    const rows = await listOfficerAssistantMessages(mock as never, "officer-1");

    expect(mock.from).toHaveBeenCalledWith("officer_assistant_messages");
    expect(mock.chain.eq).toHaveBeenCalledWith("officer_user_id", "officer-1");
    expect(mock.chain.order).toHaveBeenCalledWith("created_at", { ascending: true });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.report_id).toBe("rep-1");
  });

  it("insertOfficerAssistantMessage persists optional report_id", async () => {
    const mock = createMockClient();
    const row = await insertOfficerAssistantMessage(mock as never, {
      officerUserId: "officer-1",
      role: "assistant",
      content: "Reply",
      reportId: "rep-2",
      model: "test-model",
      latencyMs: 42,
    });

    expect(mock.chain.insert).toHaveBeenCalledWith({
      officer_user_id: "officer-1",
      report_id: "rep-2",
      role: "assistant",
      content: "Reply",
      model: "test-model",
      latency_ms: 42,
    });
    expect(row.message_id).toBe("msg-2");
    expect(row.report_id).toBe("rep-2");
  });
});
