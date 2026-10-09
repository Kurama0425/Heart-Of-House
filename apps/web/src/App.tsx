import { useEffect, useState } from "react";
import { Ingredients } from "./Ingredients";

type HealthState = "checking" | "connected" | "offline";

type ModuleCard = {
  title: string;
  description: string;
  eyebrow: string;
};

const modules: ModuleCard[] = [
  {
    title: "Ingredients",
    eyebrow: "Food cost foundation",
    description:
      "Track purchase units, quantities, and prices so recipe costs can update from real ingredient data."
  },
  {
    title: "Recipes",
    eyebrow: "Standardize the kitchen",
    description:
      "Keep ingredients, yields, instructions, and portion costs together instead of scattered across binders."
  },
  {
    title: "Prep",
    eyebrow: "Shift execution",
    description:
      "Turn recipe and par information into a clear daily prep list the kitchen can actually work from."
  },
  {
    title: "Checklists",
    eyebrow: "Open & close",
    description:
      "Give the team repeatable opening and closing tasks with a simple completion trail."
  }
];

const apiUrl =
  import.meta.env.VITE_API_URL?.replace(/\/$/, "") ?? "http://localhost:3000";

function App() {
  const [health, setHealth] = useState<HealthState>("checking");

  useEffect(() => {
    const controller = new AbortController();

    fetch(`${apiUrl}/health`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error("API health check failed");
        }

        return response.json();
      })
      .then((data: { database?: string }) => {
        setHealth(data.database === "connected" ? "connected" : "offline");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setHealth("offline");
      });

    return () => controller.abort();
  }, []);

  const healthLabel =
    health === "checking"
      ? "Checking system"
      : health === "connected"
        ? "API + database online"
        : "Backend offline";

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">HOH</div>
          <div>
            <strong>Heart of House</strong>
            <span>Your restaurant. One program.</span>
          </div>
        </div>

        <nav className="primary-nav" aria-label="Primary navigation">
          <a className="nav-link active" href="#dashboard">
            Dashboard
          </a>
          <a className="nav-link" href="#ingredients">
            Ingredients
          </a>
          <a className="nav-link" href="#recipes">
            Recipes
          </a>
          <a className="nav-link" href="#prep">
            Prep
          </a>
          <a className="nav-link" href="#checklists">
            Checklists
          </a>
          <a className="nav-link" href="#staff">
            Staff
          </a>
        </nav>

        <div className="sidebar-note">
          <span className={`status-dot ${health}`} aria-hidden="true" />
          <div>
            <strong>{healthLabel}</strong>
            <span>Local development</span>
          </div>
        </div>
      </aside>

      <main className="main-content" id="dashboard">
        <header className="page-header">
          <div>
            <p className="eyebrow">Kitchen operations</p>
            <h1>Kitchen Dashboard</h1>
            <p className="page-subtitle">
              Recipes, costs, prep, and daily kitchen work in one place.
            </p>
          </div>

          <div className="system-pill">
            <span className={`status-dot ${health}`} aria-hidden="true" />
            {healthLabel}
          </div>
        </header>

        <section className="hero-card">
          <div>
            <p className="eyebrow">Heart of House</p>
            <h2>Build the shift before the rush starts.</h2>
            <p>
              The first usable version is focused on the information a small
              kitchen needs every day: what food costs, how it is made, and what
              needs to get done.
            </p>
          </div>

          <div className="hero-stat">
            <span>Current focus</span>
            <strong>Recipes + Costing</strong>
            <small>Independent restaurant workflow</small>
          </div>
        </section>

        <section aria-labelledby="workspace-heading">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Workspace</p>
              <h2 id="workspace-heading">Kitchen tools</h2>
            </div>
            <span className="section-note">First usable version</span>
          </div>

          <div className="module-grid">
            {modules.map((module, index) => (
              <article
                className="module-card"
                id={module.title === "Ingredients" ? "ingredients-overview" : module.title.toLowerCase()}
                key={module.title}
              >
                <div className="module-number">
                  {String(index + 1).padStart(2, "0")}
                </div>
                <p className="eyebrow">{module.eyebrow}</p>
                <h3>{module.title}</h3>
                <p>{module.description}</p>
                <span className="coming-next">
                  {index === 0 ? "Available below" : "Planned"}
                </span>
              </article>
            ))}
          </div>
        </section>

        <Ingredients apiUrl={apiUrl} />

        <section className="today-panel">
          <div>
            <p className="eyebrow">Development status</p>
            <h2>The foundation is connected.</h2>
            <p>
              The API, PostgreSQL connection, migrations, restaurant records,
              and HTTP tests are in place. The web interface now has somewhere
              real to grow.
            </p>
          </div>

          <div className="progress-list" aria-label="Project progress">
            <span className="complete">Database foundation</span>
            <span className="complete">Restaurant API</span>
            <span className="complete">Dashboard shell</span>
            <span className="complete">Ingredient catalog</span>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
