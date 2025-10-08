export type GenerateOptions = {
    system?: string;
};

export interface AI {
    generateText(prompt: string, options?: GenerateOptions): Promise<string>;
}
