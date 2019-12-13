import { SQLite } from '@ionic-native/sqlite/ngx';
import { IJsonStorageItemMeta, IJsonStorageStoredObject } from 'infa-json-storage/dist/json-storage.interfaces';
import { String } from 'typescript-string-operations';
import { JsonStorage } from 'infa-json-storage/dist/json-storage';
import { IUploadQueue, IUploadQueueOptions } from './upload-queue.interfaces';
import { HttpClient } from '@angular/common/http';

/**
 * Diese Klasse liefert die Vorlage zur Implementierung einer eigenen Upload-Queue.
 * Dabei müssen zwei generische Typen angegeben werden:
 * - _MyRequest_ als Datentyp eines Arrays, das an den Server abgeschickt wird und
 * - _MyResponse_ als Datentyp, der als Rückgabewert vom Server erwartet wird.
 * 
 * Für den API-Endpunkt ist wichtig, dass der Request immer als Array abgesendet
 * wird, os dass der Eingabeparameter vom Typ Array<_MyRequest_> sein muss.
 * (Anmerkung: Für C# sind auch Listentypen geeignet.)
 * 
 * Die Serverantwort darf entweder direkt als _MyResponse_ erfolgen oder als
 * _Array<MyResponse>_. Dahinter stecken zwei unterschiedliche Kernphilosophien:
 * - wird ein Objekt vom Typ _MyResponse_ zurückgegeben, so sollte dieses Objekt
 * vom Server (z. B.) einen Zeitstempel erhalten, bis zu welchem alle Objekte aus 
 * der Queue entfernt werden dürfen, da der Server sie erfolgreich abgespeichert hat.
 * Dies setzt jedoch voraus, dass die einzelnen Objekte in der Queue (z. B. zeitlich)
 * sortierbar sind und in Reihenfolge abgespeichert werden müssen.
 * - wird ein Array vom Typ _MyResponse_ zurückgegeben, so enthält dieses Array
 * einen Eintrag für jedes ursprünglich abgesendete Element von _MyRequest_, da
 * der Request auch stets als Array übermittelt wird.
 * Dann kann je nach Beschaffenheit von _MyResponse_ der Datensatz einzeln im
 * Datenspeicher identifiziert und folglich einzeln entfernt werden, wenn die
 * Übertragung erfolgreich war. Andernfalls wird das Objekt nicht aus dem Speicher
 * entfernt.
 * 
 * Beide Konzepte sind möglich und von der jeweiligen Programmlogik abhängig.
 * 
 * @example
 * // Variante 1: Dynamische URL und Response als Einzelobjekt
 * export class MyUploadQueue<MyRequest, MyResponse> {
 *   constructor(
 *     protected sqlite: SQLite,
 *     protected http: HttpClient,
 *     protected settings: Settings,
 *   ) {
 *     super(sqlite, http, {
 *       databaseName: 'upload-queue.db',
 *       table: 'mycontext',
 *       maxLength: 10
 *     })
 *   }
 * 
 *   public url(): Promise<string> {
 *      this.settings.getApiUrl().then(url => url + 'mycontext/upload');
 *   }
 * 
 *   public onHandleResponse(response: MyResponse): void {
 *     this.clear(response.timestamp);
 *   }
 * }
 * 
 * // Variante 2: Statische URL und Response als Array
 * export class MyUploadQueue<MyRequest, MyResponse> {
 *   constructor(
 *     protected sqlite: SQLite,
 *     protected http: HttpClient,
 *   ) {
 *     super(sqlite, http, {
 *       databaseName: 'upload-queue.db',
 *       table: 'mycontext',
 *       maxLength: 10,
 *       staticUrl: 'http://myserver.com/mycontext/upload'
 *     })
 *   }
 * 
 *   public onHandleResponse(response: Array<MyResponse>): void {
 *     for (const r of response) {
 *       // Wenn Übertragung von r erfolgreich, dann
 *       // lösche Objekt aus dem Datenspeicher.
 *     }
 *   }
 * } 
 * 
 * @author Stephan Süllwold <stephan.suellwold@infa.de>
 */
export abstract class UploadQueue<T, R> extends JsonStorage<T> implements IUploadQueue
{
    constructor(
        protected sqlite: SQLite,
        protected http: HttpClient,
        protected options: IUploadQueueOptions) 
    {
        super(sqlite, options);
    }

    public async age(): Promise<Date | void> {
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

    /**
     * Wird aufgerufen, sobald ein Block mit Statusänderungen an den Server übertragen wurde.
     * @param response Das zurückgegebene Objekt ist entweder eine Ergebnismenge in Form eines 
     * Arrays, bei der jedes einzelne zuvor gesendete Element durch einen Antworteintrag
     * repräsentiert ist, oder das Ergebnis ist direkt vom vorgegebenen Rückgabetyp.
     * Bei der Rückgabe eines einzelnen Objekts wird empfohlen einen Zeitstempel zurückzugeben,
     * der im Erfolgsfall das jüngste Datum aller übertragenen Elemente repräsentiert, und
     * in _onHandleResponse_ ein _clear()_ über alle älteren oder gleich alten Elemente
     * durchzuführen
     * @example
     * onHandleResponse(response: IUploadQueueResponse) {
     *   this.clear(response.timestamp);
     *   // ergänzende eigene Implementierung
     * }
     */
    public abstract onHandleResponse(response: R | Array<R>): void;

    /**
     * Die Basisimplementierung von _send()_ fragt die ältesten Einträge aus
     * dem Speicher bis zu einer maximalen Anzahl von _maxlength_ ab und
     * sendet diese als Array via POST an die angegebene Server-URL.
     * Der Rückgabewert von POST kann entweder ein Objekt vom
     * generischen Typ _R_ oder Array<_R_> sein, womit im Anschluss
     * _onHandleResponse(response)_ aufgerufen wird.
     */
    public async send(): Promise<void> {
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
        if (items.length > 0) {
            const response: R | Array<R> = await this.http.post<Array<R>>(await this.url(), items).toPromise();
            this.onHandleResponse(response);
        }
    }
}