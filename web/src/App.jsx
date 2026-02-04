import { Routes, Route } from "react-router-dom";
import "./App.css";
import AppShell from "./components/AppShell.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Library from "./pages/Library.jsx";
import ExerciseDetail from "./pages/ExerciseDetail.jsx";
import History from "./pages/History.jsx";
import HistoryDetail from "./pages/HistoryDetail.jsx";
import Builder from "./pages/Builder.jsx";
import Settings from "./pages/Settings.jsx";
import NotFound from "./pages/NotFound.jsx";

function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Dashboard />} />
        <Route path="library" element={<Library />} />
        <Route path="library/:exerciseId" element={<ExerciseDetail />} />
        <Route path="exercise/:exerciseId" element={<ExerciseDetail />} />
        <Route path="history" element={<History />} />
        <Route path="history/:sessionId" element={<HistoryDetail />} />
        <Route path="create" element={<Builder />} />
        <Route path="edit/:workoutCode" element={<Builder />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

export default App;
