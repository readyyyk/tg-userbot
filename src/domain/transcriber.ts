export type TranscribeOptions = {
    prompt?: string;
    language?: string;
};

export interface Transcriber {
    transcribeOggFile(filePath: string, options?: TranscribeOptions): Promise<string>;
}
