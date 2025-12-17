import { useLocation } from "react-router";
import SearchBar from "./SearchBar";
import InfoButton from "./InfoButton";
import ThemeToggle from "./ThemeToggle";

export default function Layout({ children }: { children: React.ReactNode }) {
	const location = useLocation();
	const isHomePage = location.pathname === "/";

	return (
		<>
			{!isHomePage && <SearchBar loading={false} />}
			<InfoButton />
			<ThemeToggle
				styles={{
					root: {
						position: "absolute",
						top: "0.5rem",
						right: "0.5rem",
					},
				}}
				size="lg"
			/>
			{children}
		</>
	);
}
