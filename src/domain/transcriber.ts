export type TranscribeOptions = {
    prompt?: string;
    language?: string;
    mimeType?: string;
};

export interface Transcriber {
    transcribeAudio(filePath: string, options?: TranscribeOptions): Promise<string>;
}
