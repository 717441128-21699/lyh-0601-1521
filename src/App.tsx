import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import MainLayout from "@/components/layout/MainLayout";
import Home from "@/pages/Home";
import ImpactAnalysis from "@/pages/ImpactAnalysis";
import BatchExecute from "@/pages/BatchExecute";
import RollbackCenter from "@/pages/RollbackCenter";
import ReportCenter from "@/pages/ReportCenter";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/impact" element={<ImpactAnalysis />} />
          <Route path="/execute" element={<BatchExecute />} />
          <Route path="/rollback" element={<RollbackCenter />} />
          <Route path="/report" element={<ReportCenter />} />
        </Route>
      </Routes>
    </Router>
  );
}
