import Sidebar from './Sidebar';
import Header from './Header';

/**
 * MainLayout Component
 * 
 * Layout principal de l'application qui structure l'interface utilisateur
 * Comprend la barre latérale (Sidebar), le header fixe et la zone de contenu défilante
 * 
 * Ce composant est utilisé comme wrapper pour toutes les pages protégées de l'application
 * Il assure une structure cohérente et permet le scroll indépendant du contenu
 * 
 * @component
 * @param {Object} props - Propriétés du composant
 * @param {React.ReactNode} props.children - Contenu de la page à afficher
 * @param {string} [props.title] - Titre de la page (optionnel)
 * @param {string} [props.subtitle] - Sous-titre/description de la page (optionnel)
 * @param {React.ReactNode} [props.badge] - Badge ou élément supplémentaire à afficher dans le header (optionnel)
 * @returns {JSX.Element} Layout structuré avec sidebar, header et contenu
 */
export default function MainLayout({ children, title, subtitle, badge }) {
  return (
    <div className="app-layout">
      {/* Barre latérale de navigation fixe à gauche */}
      <Sidebar />
      
      {/* Header fixe en haut de la page */}
      <Header />
      
      {/* Zone principale de contenu */}
      <main className="main-content">
        {/* Conteneur avec scroll indépendant pour le contenu */}
        <div className="content-scroll">
          {/* Header de page avec titre et sous-titre (si fournis) */}
          {(title || subtitle) && (
            <header className="page-header">
              <div>
                {title && <h1>{title}</h1>}
                {subtitle && <p className="page-subtitle">{subtitle}</p>}
              </div>
              {/* Badge ou élément supplémentaire optionnel */}
              {badge}
            </header>
          )}
          {/* Corps de la page contenant le contenu principal */}
          <div className="page-body">{children}</div>
        </div>
      </main>
    </div>
  );
}
