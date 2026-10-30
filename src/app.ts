const DEFAULT_IDS = [1, 2, 3];
const DEFAULT_DELAY = 0;
const MAX_IDS = 5;
const MAX_DELAY = 5000;
const API = "https://dummyjson.com/users";

interface User {
    firstName: string;
    lastName: string;
    email: string;
    address?: { city?: string };
    company?: { name?: string };
}

const cancelBtn = document.getElementById("cancel") as HTMLButtonElement;
const summary = document.getElementById("summary") as HTMLOutputElement;
const usersBox = document.getElementById("users") as HTMLElement;


interface Params {
    ids: number[];
    delay: number;
}

function parseParams(): Params | string {
    const params = new URLSearchParams(location.search);
    const idsRaw = params.get("ids");
    const delayRaw = params.get("delay");

    let ids: number[];
    if (idsRaw === null) {
        ids = DEFAULT_IDS;
    } else {
        const parts = idsRaw.split(",");
        if (parts.length < 1 || parts.length > MAX_IDS) {
            return `Некорректный параметр ids: нужно от 1 до ${MAX_IDS} идентификаторов`;
        }
        ids = [];
        for (const part of parts) {
            if (!/^\d+$/.test(part)) {
                return `Некорректный идентификатор: "${part}"`;
            }
            const n = Number(part);
            if (!Number.isSafeInteger(n) || n <= 0) {
                return `Идентификатор должен быть положительным целым: "${part}"`;
            }
            ids.push(n);
        }
    }

    let delay = DEFAULT_DELAY;
    if (delayRaw !== null) {
        if (!/^\d+$/.test(delayRaw)) {
            return `Некорректный параметр delay: "${delayRaw}"`;
        }
        delay = Number(delayRaw);
        if (delay > MAX_DELAY) {
            return `Параметр delay должен быть от 0 до ${MAX_DELAY}`;
        }
    }

    return {ids, delay};
}

function createCard(id: number): HTMLElement {
    const article = document.createElement("article");
    article.dataset.id = String(id);
    article.dataset.state = "loading";
    return article;
}

function fillSuccess(article: HTMLElement, user: User): void {
    article.dataset.state = "success";
    article.replaceChildren();

    const name = document.createElement("h2");
    name.className = "name";
    name.textContent = `${user.firstName} ${user.lastName}`;

    const email = document.createElement("a");
    email.className = "email";
    email.textContent = user.email;
    email.href = `mailto:${user.email}`;

    const city = document.createElement("span");
    city.className = "city";
    city.textContent = user.address?.city ?? "";

    const company = document.createElement("span");
    company.className = "company";
    company.textContent = user.company?.name ?? "";

    article.append(name, email, city, company);
}

function fillError(article: HTMLElement, message: string): void {
    article.dataset.state = "error";
    article.replaceChildren();

    const msg = document.createElement("span");
    msg.className = "message";
    msg.textContent = message;

    article.append(msg);
}

function fillAborted(article: HTMLElement): void {
    article.dataset.state = "aborted";
    article.replaceChildren();

    const msg = document.createElement("span");
    msg.className = "message";
    msg.textContent = "Запрос отменён";

    article.append(msg);
}

async function fetchUser(id: number, delay: number, signal: AbortSignal): Promise<User> {
    const response = await fetch(`${API}/${id}?delay=${delay}`, { signal });
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
    return (await response.json()) as User;
}

function isAbortError(reason: unknown): boolean {
    return reason instanceof DOMException && reason.name === "AbortError";
}

async function main(): Promise<void> {
    const parsed = parseParams();

    if (typeof parsed === "string") {
        usersBox.replaceChildren();
        summary.dataset.state = "error";
        summary.textContent = parsed;
        return;
    }

    const { ids, delay } = parsed;

    const controller = new AbortController();
    cancelBtn.disabled = false;
    cancelBtn.onclick = () => controller.abort();

    summary.dataset.state = "loading";
    summary.textContent = "Загрузка...";

    usersBox.replaceChildren();
    const cards = ids.map((id) => {
        const card = createCard(id);
        usersBox.append(card);
        return card;
    });

    const results = await Promise.allSettled(
        ids.map((id) => fetchUser(id, delay, controller.signal)),
    );

    cancelBtn.disabled = true;

    let success = 0;
    let errors = 0;
    let aborted = 0;

    results.forEach((result, index) => {
        const card = cards[index];

        if (result.status === "fulfilled") {
            success++;
            fillSuccess(card, result.value);
            return;
        }

        if (isAbortError(result.reason)) {
            aborted++;
            fillAborted(card);
        } else {
            errors++;
            const message = result.reason instanceof Error ? result.reason.message : "Ошибка запроса";
            fillError(card, message);
        }
    });

    if (controller.signal.aborted) {
        summary.dataset.state = "aborted";
        summary.textContent = `Отменено: ${aborted}; загружено: ${success}; ошибок: ${errors}`;
    } else if (errors === 0) {
        summary.dataset.state = "success";
        summary.textContent = `Загружено: ${success}; ошибок: 0`;
    } else if (success === 0) {
        summary.dataset.state = "error";
        summary.textContent = `Загружено: 0; ошибок: ${errors}`;
    } else {
        summary.dataset.state = "partial";
        summary.textContent = `Загружено: ${success}; ошибок: ${errors}`;
    }
}

main();