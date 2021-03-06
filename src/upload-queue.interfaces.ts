import { IJsonStorageOptions, IJsonStorageKey } from 'infa-json-storage/dist/json-storage.interfaces';

export interface IUploadQueueOptions extends IJsonStorageOptions {
    /**
     * Legt fest, wieviele Einträge maximal an den Server übermittelt werden dürfen.
     * Falls der Wert nicht angegeben ist, gibt es keine Obergrenze und der Upload
     * wird versuchen stets alle verbleibenden Einträge der Datentabelle auf einmal
     * an den Server zu übermitteln.
     * 
     * Je nach Datengröße und -menge kann dies zu Timeouts führen, weshalb eine
     * Begrenzung sinnvoll ist.
     */
    maxLength?: number;

    /**
     * Wird die Methode url() nicht überschrieben, so muss eine statische URL
     * angegeben werden, zu der die Datenübertragung stattfinden soll.
     */
    staticUrl?: string;
}

/**
 * Dient als Vorlage zur Kennzeichnung einer Klasse, die als
 * Rückgabewert vom Server einen Zeitstempel erwartet.
 */
export interface IUploadQueueResponse {
    /**
     * Gibt den Zeitpunkt an, bis zu welchem die Daten auf dem Server jetzt
     * aktuell sein sollten. 
     * 
     * Der zurückgegebene Zeitstempel sollte verwendet werden können, um
     * alle Objekte aus dem Datenbestand, die gleich alt oder älter sind,
     * entfernen zu können.
     * 
     * Diese Zuverlässigkeit dieser Logik ist jedoch
     * abhängig von der Implementierung des jeweiligen Server-Endpunktes.
     */
    timestamp: Date;
}

export interface IUploadQueue {
    /**
     * Gibt das Datum des ältesten Datensatzes an, der sich im Datenspeicher befindet.
     */
    age(): Promise<Date | void>;

    /**
     * Entfernt unwiderruflich alle Einträge aus dem aktuellen Datenspeicher.
     * @param filterExpression Die zu löschenden Einträge können über den Filterausdruck
     * eingeschränkt werden. Entweder wird ein Filterobjekt angegeben, das über einen
     * Schlüssel vom Typ _IJsonStorageKey_ und / oder einen Zeitstempel vom Typ _Date_
     * verfügen kann, oder ein beliebiger SQL-Filterausdruck, der in der WHERE-Bedingung
     * verarbeitet wird.
     */
    clear(filterExpression: { key?: IJsonStorageKey, timestamp?: Date } | string): Promise<void>;

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
    send(): Promise<void>;
}