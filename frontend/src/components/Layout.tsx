import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import "../styles/AppLayout.css";

type LayoutProps = {
  children: React.ReactNode;
};

function Layout({ children }: LayoutProps) {
  return (
    <div className="app-layout">
      <Sidebar />

      <main className="main-area">
        <Topbar />
        <section className="content-area">{children}</section>
      </main>
    </div>
  );
}

export default Layout;