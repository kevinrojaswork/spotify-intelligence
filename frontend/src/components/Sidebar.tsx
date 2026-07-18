import { useEffect, useState, type MouseEvent } from "react";

type DashboardSection = {
  id: string;
  label: string;
  icon: string;
};

const DASHBOARD_SECTIONS: DashboardSection[] = [
  { id: "dashboard-summary", label: "Resumen", icon: "▦" },
  { id: "musical-dna", label: "ADN musical", icon: "◉" },
  { id: "smart-insights", label: "Insights inteligentes", icon: "✦" },
  { id: "top-playlists", label: "Top playlists", icon: "≡" },
  { id: "top-artists", label: "Top artistas", icon: "♬" },
  { id: "top-songs", label: "Top canciones", icon: "♪" },
  { id: "top-albums", label: "Top álbumes", icon: "▣" },
  { id: "duplicate-songs", label: "Duplicadas", icon: "⧉" },
];

function Sidebar() {
  const [activeSection, setActiveSection] = useState("dashboard-overview");
  const [availableSectionIds, setAvailableSectionIds] = useState<string[]>([]);

  useEffect(() => {
    const updateAvailableSections = () => {
      const nextSectionIds = DASHBOARD_SECTIONS.filter((section) =>
        document.getElementById(section.id)
      ).map((section) => section.id);

      setAvailableSectionIds((currentSectionIds) =>
        currentSectionIds.join("|") === nextSectionIds.join("|")
          ? currentSectionIds
          : nextSectionIds
      );
    };

    updateAvailableSections();

    const dashboardObserver = new MutationObserver(updateAvailableSections);

    dashboardObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      dashboardObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    let animationFrameId = 0;

    const updateActiveSection = () => {
      animationFrameId = 0;

      const sectionIds = [
        "dashboard-overview",
        ...availableSectionIds,
      ];

      const activationLine = Math.min(220, window.innerHeight * 0.3);
      let currentSectionId = "dashboard-overview";

      for (const sectionId of sectionIds) {
        const section = document.getElementById(sectionId);

        if (!section) {
          continue;
        }

        if (section.getBoundingClientRect().top <= activationLine) {
          currentSectionId = sectionId;
        }
      }

      setActiveSection(currentSectionId);
    };

    const requestActiveSectionUpdate = () => {
      if (animationFrameId !== 0) {
        return;
      }

      animationFrameId = window.requestAnimationFrame(updateActiveSection);
    };

    requestActiveSectionUpdate();

    window.addEventListener("scroll", requestActiveSectionUpdate, {
      passive: true,
    });
    window.addEventListener("resize", requestActiveSectionUpdate);

    return () => {
      window.removeEventListener("scroll", requestActiveSectionUpdate);
      window.removeEventListener("resize", requestActiveSectionUpdate);

      if (animationFrameId !== 0) {
        window.cancelAnimationFrame(animationFrameId);
      }
    };
  }, [availableSectionIds]);

  const handleSectionClick = (
    event: MouseEvent<HTMLAnchorElement | HTMLButtonElement>,
    sectionId: string
  ) => {
    event.preventDefault();

    const targetSection = document.getElementById(sectionId);

    if (!targetSection) {
      return;
    }

    setActiveSection(sectionId);
    window.history.replaceState(null, "", `#${sectionId}`);

    targetSection.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const availableSections = DASHBOARD_SECTIONS.filter((section) =>
    availableSectionIds.includes(section.id)
  );

  return (
    <aside className="sidebar">
      <h2 className="sidebar-logo">Spotify Intelligence</h2>

      <nav className="sidebar-nav" aria-label="Navegación principal">
        <button
          type="button"
          className={`sidebar-main-link ${
            activeSection === "dashboard-overview" ? "active" : ""
          }`}
          onClick={(event) =>
            handleSectionClick(event, "dashboard-overview")
          }
        >
          <span className="sidebar-link-icon" aria-hidden="true">
            🏠
          </span>
          <span>Dashboard</span>
        </button>

        {availableSections.length > 0 && (
          <div className="sidebar-section-group">
            <p className="sidebar-section-title">Explorar análisis</p>

            {availableSections.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className={`sidebar-section-link ${
                  activeSection === section.id ? "active" : ""
                }`}
                aria-current={
                  activeSection === section.id ? "location" : undefined
                }
                onClick={(event) =>
                  handleSectionClick(event, section.id)
                }
              >
                <span className="sidebar-link-icon" aria-hidden="true">
                  {section.icon}
                </span>
                <span>{section.label}</span>
              </a>
            ))}
          </div>
        )}

        <div className="sidebar-secondary-nav">
          <button
            type="button"
            onClick={() =>
              alert("Configuración estará disponible pronto.")
            }
          >
            <span className="sidebar-link-icon" aria-hidden="true">
              ⚙️
            </span>
            <span>Configuración</span>
          </button>

          <button
            type="button"
            onClick={() =>
              alert(
                "Spotify Intelligence v1.0\n\nAnaliza tus playlists, artistas, canciones, álbumes, duplicados, ADN Musical e insights inteligentes."
              )
            }
          >
            <span className="sidebar-link-icon" aria-hidden="true">
              ℹ️
            </span>
            <span>Acerca de</span>
          </button>
        </div>
      </nav>
    </aside>
  );
}

export default Sidebar;
