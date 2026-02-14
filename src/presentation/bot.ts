import { Api, type TelegramClient } from "telegram";
import { NewMessage } from "telegram/events";
import type { Handler } from "@/presentation/handlers";

export class TgUserbot {
    private readonly client: TelegramClient;
    private readonly handlers: Handler;
    private selfUserId: string | null = null;

    constructor(client: TelegramClient, handlers: Handler) {
        this.client = client;
        this.handlers = handlers;
    }

    async start(): Promise<void> {
        const me = await this.client.getMe();
        this.selfUserId = me instanceof Api.User ? String(me.id) : null;
        this.client.addEventHandler(this.onNewMessage, new NewMessage({}));
    }

    private onNewMessage = async (event: unknown): Promise<void> => {
        const message = (event as { message?: Api.Message }).message as Api.Message | undefined;
        if (!message) return;
        for (const h of this.handlers) {
            try {
                const triggered = await h.isTriggered({ client: this.client, message, selfUserId: this.selfUserId });
                if (triggered) {
                    console.info(`[handler:${h.name}] started at: ${Date.now()}`);
                    await h.handler({ client: this.client, message });
                    console.info(`[handler:${h.name}] finished at: ${Date.now()}`);
                    break;
                }
            } catch (error) {
                // keep the loop resilient
                console.error(`[handler:${h.name}] errored at: ${Date.now()}, error:`, error);
            }
        }
    };
}
