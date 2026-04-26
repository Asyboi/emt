import { createBrowserRouter } from "react-router";
import { Layout } from "./components/layout";
import { QIReviewLayout } from "./components/qi-review-layout";
import { Landing } from "./landing/Landing";
import { Dashboard } from "./pages/dashboard";
import { NewReport } from "./pages/new-report";
import { PcrDraft } from "./pages/pcr-draft";
import { PcrNew } from "./pages/pcr-new";
import { PcrView } from "./pages/pcr-view";
import { Processing } from "./pages/processing";
import { Review } from "./pages/review";
import { ReviewReport } from "./pages/review-report";
import { Finalize } from "./pages/finalize";
import { Archive } from "./pages/archive";

export const router = createBrowserRouter([
  {
    index: true,
    Component: Landing,
  },
  {
    path: "/",
    Component: Layout,
    children: [
      {
        path: "dashboard",
        Component: Dashboard,
      },
      {
        Component: QIReviewLayout,
        children: [
          {
            path: "qi-review",
            Component: NewReport,
          },
          {
            path: "pcr-new",
            Component: PcrNew,
          },
          {
            path: "pcr-draft/:caseId",
            Component: PcrDraft,
          },
          {
            path: "pcr/:caseId",
            Component: PcrView,
          },
          {
            path: "processing/:caseId",
            Component: Processing,
          },
          {
            path: "review/:incidentId",
            Component: Review,
          },
          {
            path: "review/:incidentId/report",
            Component: ReviewReport,
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
    ],
  },
]);
