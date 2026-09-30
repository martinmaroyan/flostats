import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router";
import { Center, Loader } from "@mantine/core";
import Layout from "./components/Layout";
import HomePage from "./components/HomePage";

const Athletes = lazy(() => import("./Athletes"));
const SearchResultsPage = lazy(() => import("./components/SearchResults"));
const CompareAthletes = lazy(() => import("./components/compare/CompareAthletes"));

export default function App() {
	return (
		<BrowserRouter>
			<Layout>
				<Suspense fallback={<Center py="xl"><Loader aria-label="Loading page" /></Center>}>
					<Routes>
						<Route path="/" element={<HomePage />} />
						<Route path="/search" element={<SearchResultsPage />} />
						<Route path="/athletes/:id" element={<Athletes />} />
						<Route path="/teams/:id" element={<Athletes />} />
						<Route path="/compare" element={<CompareAthletes />} />
					</Routes>
				</Suspense>
			</Layout>
		</BrowserRouter>
	);
}
