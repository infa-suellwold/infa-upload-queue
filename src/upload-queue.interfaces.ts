import { IJsonStorageOptions } from "infa-json-storage/dist/json-storage.interfaces";

export interface IUploadQueueOptions extends IJsonStorageOptions {
    maxLength?: number;
    staticUrl?: string;
}

export interface IUploadQueueResponse {
    timestamp: Date;
}

export interface IUploadQueue {
    /**
     * Gibt das Datum des ältesten Datensatzes an, der sich im Datenspeicher befindet.
     */
    age(): Promise<Date | void>;

    /**
     * Entfernt alle Einträge aus der Tabelle. Wird ein Zeitstempel angegeben, so
     * werden alle Einträge, die nach dem angegebenen Zeitstempel eingetragen wurden,
     * beim Löschen ignoriert.
     * @param timestamp 
     */
    clear(timestamp?: Date): Promise<void>;

    /**
     * Liefert die WebAdresse zurück, zu der die Datenpakete gesendet werden.
     * Wenn über die Optionen eine statische URL hinterlegt wurde, wird diese
     * verwendet, andernfalls muss diese Methode überschrieben werden.
     */
    url(): Promise<string>;

    /**
     * Sendet die aktuell im Datenspeicher befindlichen Elemente an eine Serveradresse.
     * Dabei wird im Erfolgsfall der Zeitstempel des jüngsten gesendeten Elements
     * zurückerwartet, anhand dessen alle älteren Elemente im Datenspeicher entfernt
     * werden können. Dies setzt voraus, dass das Senden der Elemente stets nach dem
     * FIFO-Prinzip gesendet werden (älteste zuerst).
     */
    send<R extends IUploadQueueResponse>(): Promise<R>;
}