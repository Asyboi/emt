import { createBrowserRouter } from "react-router";
import { Layout } from "./components/layout";
import { NewReport } from "./pages/new-report";
import { Processing } from "./pages/processing";
import { Review } from "./pages/review";
import { Finalize } from "./pages/finalize";
import { Archive } from "./pages/archive";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Layout,
    children: [
      {
        index: true,
        Component: NewReport,
      },
      {
        path: "processing",
        Component: Processing,
      },
      {
        path: "review/:incidentId",
        Component: Review,
      },
      {
        path: "finalize/:incidentId",
        Component: Finalize,
      },
      {
        path: "archive",
        Component: Archive,
      },
    ],
  },
]);
