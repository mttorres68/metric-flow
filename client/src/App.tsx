import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import VendedoresLista from "./pages/VendedoresLista";
import VendedorDetalhes from "./pages/VendedorDetalhes";
import Compliance from "./pages/Compliance";
import Clientes from "./pages/Clientes";
import Relatorio from "./pages/Relatorio";
import RotaCoaching from "./pages/rota-coaching/RotaCoaching";
import AppCampeao from "./pages/rota-coaching/AppCampeao";
import AgendaGA from "./pages/rota-coaching/AgendaGA";
import RelatorioSemanal from "./pages/RelatorioSemanal";
import Analise from "./pages/Analise";
import AnaliseSemanal from "./pages/analise/AnaliseSemanal";
import AnaliseVisitasDetalhes from "./pages/AnaliseVisitasDetalhes";
import AnaliseForeaRaio from "./pages/AnaliseForeaRaio";
import TrelloAtraso from "./pages/trello";
import AgendaGV from "./pages/agenda-gv";
import WhatsApp from "./pages/WhatsApp";
import Assessment from "./pages/Assessment";
// MetricFlow — Pastel Command Center — tema claro com pastéis

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/vendedores"} component={VendedoresLista} />
      <Route path={"/vendedor/:revenda/:vendedor"} component={VendedorDetalhes} />
      <Route path={"/404"} component={NotFound} />
      <Route path="/compliance" component={Compliance} />
      <Route path="/clientes" component={Clientes} />
      <Route path="/relatorio" component={Relatorio} />
      <Route path="/rota-coaching" component={RotaCoaching} />
      <Route path="/rota-coaching/app-campeao" component={AppCampeao} />
      <Route path="/rota-coaching/agenda-ga" component={AgendaGA} />
      <Route path="/relatorio-semanal" component={RelatorioSemanal} />
      <Route path="/analises" component={Analise} />
      <Route path="/analises/semanal" component={AnaliseSemanal} />
      <Route path="/analises/vendedor/:revenda/:vendedor/:data" component={AnaliseVisitasDetalhes} />
      <Route path="/analises/foera-raio/:revenda/:data" component={AnaliseForeaRaio} />
      <Route path="/trello-atraso" component={TrelloAtraso} />
      <Route path="/agenda-gv" component={AgendaGV} />
      <Route path="/whatsapp" component={WhatsApp} />
      <Route path="/assessment" component={Assessment} />


      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
