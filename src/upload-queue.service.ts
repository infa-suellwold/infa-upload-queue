import { SQLite } from '@ionic-native/sqlite/ngx';
import { HttpClient } from '@angular/common/http';
import { IUploadQueue } from './upload-queue.interfaces';

export abstract class UploadQueueService
{
    private timerId: number | undefined;

    constructor(
        protected sqlite: SQLite,
        protected http: HttpClient) { }

    public startService(interval?: number): void {
        if (this.timerId) {
            return;
        }
        this.timerId = setInterval(async () => {
            const handlers: Array<IUploadQueue> = this.getHandlers();
            for (let handler of handlers) {
                await handler.send();
            }   
        }, interval ? interval : 10000);
    }

    public stopService(): void {
        if (!this.timerId) {
            return;
        }
        clearInterval(this.timerId);
    }

    public abstract getHandlers(): Array<IUploadQueue>;
}