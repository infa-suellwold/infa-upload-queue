import { SQLite } from '@ionic-native/sqlite/ngx';
import { HttpClient } from '@angular/common/http';
import { UploadQueue } from './upload-queue';
import { IUploadQueue } from './upload-queue.interfaces';
import { JsonStorage } from 'infa-json-storage/dist/json-storage';
import { Injectable } from '@angular/core';

@Injectable()
export class UploadQueueService 
{
    private timerId: number | undefined;
    private handlers: Array<{ id: string, queue: IUploadQueue }>;

    constructor(
        protected sqlite: SQLite,
        protected http: HttpClient) 
    { 
        this.handlers = new Array<{ id: string, queue: IUploadQueue }>();
    }

    public startService(interval?: number): void {
        if (this.timerId) {
            return;
        }
        this.timerId = setInterval(async () => {
            for (let handler of this.handlers) {
                let timestamp: Date = await handler.queue.send();
                if (timestamp) {
                    await handler.queue.clear(timestamp);
                }
            }   
        }, interval ? interval : 10000);
    }

    public stopService(): void {
        if (!this.timerId) {
            return;
        }
        clearInterval(this.timerId);
    }

    public register<T>(id: string, handler: UploadQueue<T>) {
        this.unregister(id);
        this.handlers.push({ id, queue: handler });
    }

    public unregister(id: string) {
        const idx = this.handlers.findIndex(x => x.id === id);
        if (idx > -1) {
            this.handlers.splice(idx, 1);
        }
    }

    public find<T>(id: string): (IUploadQueue & JsonStorage<T>) | undefined {
        const item = this.handlers.find(x => x.id === id);
        if (item) {
            return item.queue as (IUploadQueue & JsonStorage<T>);
        }
        return undefined;
    }
}