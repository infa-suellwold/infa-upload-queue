import { SQLite } from '@ionic-native/sqlite/ngx';
import { IJsonStorageItemMeta, IJsonStorageStoredObject } from 'infa-json-storage/dist/json-storage.interfaces';
import { String } from 'typescript-string-operations';
import { JsonStorage } from 'infa-json-storage/dist/json-storage';
import { IUploadQueue, IUploadQueueOptions } from './upload-queue.interfaces';
import { HttpClient } from '@angular/common/http';

export abstract class UploadQueue<T> extends JsonStorage<T> implements IUploadQueue
{
    constructor(
        protected sqlite: SQLite,
        protected http: HttpClient,
        protected options: IUploadQueueOptions) 
    {
        super(sqlite, options);
    }

    public age(): Promise<Date | void> {
        const statement: string = String.Format('select top 1 timestamp from {0} order by timestamp asc', this.options.table);
        return this._databaseObject().then(async (db) => {
            await this._anyway(db.executeSql(statement), (t) => {
                if (t.rows.length > 0) {
                    return Promise.resolve(t.rows.item(0).timestamp);
                } else {
                    return Promise.resolve();
                }
            });
        });
    }

    public url(): Promise<string> {
        if (this.options.staticUrl) {
            return Promise.resolve(this.options.staticUrl);
        } else {
            return Promise.reject();
        }
    }

    async send(): Promise<Date> {
        const meta: Array<IJsonStorageItemMeta> = (await this.getMeta())
            .sort((l: IJsonStorageItemMeta, r: IJsonStorageItemMeta) => {
                return l.timestamp.getMilliseconds() - r.timestamp.getMilliseconds()
            })
            .filter((v, i) => !this.options.maxLength || i < this.options.maxLength);
        const items: Array<IJsonStorageStoredObject<T>> = new Array<IJsonStorageStoredObject<T>>();
        for (var key of meta) {
            const item: (void | IJsonStorageStoredObject<T>) = await this.restore(key);
            if (item) {
                items.push(item);
            }
        }
        return this.http.post<Date>(await this.url(), items).toPromise();
    }
}