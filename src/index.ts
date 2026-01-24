#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url"; // ✅
import prompts from "prompts";
import pc from "picocolors";

const __filename = fileURLToPath(import.meta.url); // ✅
const __dirname = path.dirname(__filename);        // ✅

const TEMPLATES = ["vite-react-ts", "vite-vanilla-ts"] as const;
type Template = typeof TEMPLATES[number];

async function main() {
    const argv = process.argv.slice(2);

    let projectName = argv[0];
    let templateArg = argv.find(a => a.startsWith("--template="))?.split("=")[1] as Template | undefined;

    const questions: prompts.PromptObject[] = [];

    if (!projectName) {
        questions.push({
            type: "text",
            name: "projectName",
            message: "Project name:",
            initial: "brass-app"
        });
    }

    if (!templateArg || !TEMPLATES.includes(templateArg)) {
        questions.push({
            type: "select",
            name: "template",
            message: "Choose a template",
            choices: TEMPLATES.map(t => ({ title: t, value: t }))
        });
    }

    const answers = questions.length > 0 ? await prompts(questions) : {};

    projectName ??= answers.projectName;
    const template = templateArg ?? answers.template;

    if (!projectName || !template) {
        console.log(pc.red("✖ Aborted"));
        process.exit(1);
    }

    const targetDir = path.resolve(process.cwd(), projectName);
    if (fs.existsSync(targetDir)) {
        console.log(pc.red(`✖ Directory already exists: ${projectName}`));
        process.exit(1);
    }

    const templateDir = path.resolve(__dirname, "../templates", template);


    copyDir(templateDir, targetDir);
    replacePackageName(targetDir, projectName);

    console.log();
    console.log(pc.green("✔ Project created"));
    console.log();
    console.log(pc.bold("Next steps:"));
    console.log(`  cd ${projectName}`);
    console.log("  npm install");
    console.log("  npm run dev");
    console.log();
}

function copyDir(src: string, dest: string) {
    fs.mkdirSync(dest, { recursive: true });

    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            copyDir(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

function replacePackageName(projectDir: string, name: string) {
    const pkgPath = path.join(projectDir, "package.json");
    if (!fs.existsSync(pkgPath)) return;

    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    pkg.name = name;
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
