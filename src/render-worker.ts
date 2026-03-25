import { parentPort } from "node:worker_threads";
import { minify as minifyHtml } from "html-minifier-terser";
import mjml2html from "mjml";

type RenderOptions = {
    fonts?: Record<string, string>;
    keepComments?: boolean;
    minify?: boolean;
};

type RenderRequest = {
    taskId: number;
    mjmlInput: string;
    options: RenderOptions;
};

const SAFE_HTML_MINIFIER_CONFIG = {
    collapseWhitespace: true,
    conservativeCollapse: true,
    minifyCSS: true,
    caseSensitive: true,
    keepClosingSlash: true,
    removeComments: false,
};

if (!parentPort) {
    throw new Error("Render worker started without a parent port");
}

parentPort.on("message", async (message: RenderRequest) => {
    const { taskId, mjmlInput, options } = message;

    try {
        const mjmlOptions: {
            validationLevel: "soft";
            fonts?: Record<string, string>;
            keepComments?: boolean;
        } = { validationLevel: "soft" };

        if (options.fonts !== undefined) mjmlOptions.fonts = options.fonts;
        if (options.keepComments !== undefined) mjmlOptions.keepComments = options.keepComments;

        const result = mjml2html(mjmlInput, mjmlOptions);
        let htmlOutput = result.html;

        if (options.minify === true) {
            htmlOutput = await minifyHtml(htmlOutput, SAFE_HTML_MINIFIER_CONFIG);
        }

        const errors = result.errors.map((error) => ({
            tagName: error.tagName,
            message: error.message,
            line: error.line,
        }));

        parentPort?.postMessage({
            taskId,
            ok: true,
            html: htmlOutput,
            errors,
        });
    } catch (error) {
        const messageText = error instanceof Error ? error.message : "Failed to render MJML";
        parentPort?.postMessage({
            taskId,
            ok: false,
            message: messageText,
            statusCode: 500,
        });
    }
});
