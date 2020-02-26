import { SQLite } from '@ionic-native/sqlite/ngx';
import { HttpClient } from '@angular/common/http';
import { IUploadQueue } from './upload-queue.interfaces';

/**
 * Vorlage zum Erstellen eines zeitgesteuerten Dienstes, der mehrere
 * UploadQueues verwendet und in regelmäßigen Intervallen dafür sorgt, dass
 * deren Objekte aus der jeweiligen lokalen Datentabelle auf dem Gerät an 
 * den zuständigen Server übertragen werden.
 */
export abstract class UploadQueueService
{
    /**
     * Repräsentiert den Handler des Timers, der den Wiederholungsprozess
     * steuert.
     */
    private timerId: number | undefined;

    constructor(
        protected sqlite: SQLite,
        protected http: HttpClient) { }

    /** 
     * Startet den Dienst, sofern dieser noch nicht gestartet wurde und
     * stellt als Wiederholrate das vorgegebene Intervall in Millisekunden ein.
     * 
     * Ist kein Intervall angegeben, so wird 10000 ms als voreingestellter
     * Wert verwendet. 
     */
    public startService(interval?: number): void {
        if (this.timerId) {
            return;
        }
        this.timerId = setInterval(async () => {
            const handlers: Array<IUploadQueue> = this.getHandlers();
            for (let handler of handlers) {
                try {
                    await handler.send();
                } catch (e) {
                    console.error('Exceptional error while trying to upload data.', handler, this);
                }
            }   
        }, interval ? interval : 10000);
        console.log('Upload service started.', this.constructor.name, this.timerId, this);
    }

    /** 
     * Stoppt den Dienst, falls dieser gerade läuft.
     */
    public stopService(): void {
        if (!this.timerId) {
            return;
        }
        clearInterval(this.timerId);
        this.timerId = undefined;
        console.log('Upload service stopped.', this.constructor.name, this);
    }

    /**
     * Die Liste muss von der Zielklasse überschrieben werden und alle
     * UploadQueues wiedergeben, die bei dem zeitlich gesteuerten Prozess
     * des Datenuploads berücksichtigt werden sollen.
     * 
     * Dabei wird empfohlen, die einzelnen UploadQueues als typisierte,
     * konkrete Member innerhalb der Zielklasse zu verwalten, um diese
     * im Bedarfsfall auch einzeln ansprechen zu können.
     */
    public abstract getHandlers(): Array<IUploadQueue>;
}

/**
 * Vorlage zum Erstellen eines zeitgesteuerten Dienstes, der ein einzelnes
 * UploadQueue verwendet und in regelmäßigen Intervallen dafür sorgt, dass
 * die Objekte von der lokalen Datentabelle auf dem Gerät an den zuständigen
 * Server übertragen werden.
 */
export abstract class SingleUploadQueue<T extends IUploadQueue> extends UploadQueueService
{
    public queue?: T;

    constructor(
        protected sqlite: SQLite,
        protected http: HttpClient) { 
        super(sqlite, http);
    }
    
    public getHandlers(): Array<IUploadQueue> {
        const arr: Array<IUploadQueue> = new Array<IUploadQueue>();
        if (this.queue) {
            arr.push(this.queue);
        }
        return arr;
    }
}