import { Group } from "@mantine/core";
import { DateInput } from "@mantine/dates";
import dayjs from "dayjs";

export type BoutDateFilterProps = {
	startDate: Date | null;
	endDate: Date | null;
	setStartDate: React.Dispatch<React.SetStateAction<Date | null>>;
	setEndDate: React.Dispatch<React.SetStateAction<Date | null>>;
	oldestBout?: Date;
	newestBout?: Date;
};

export default function BoutDateFilter({ startDate, endDate, setStartDate, setEndDate, oldestBout, newestBout }: BoutDateFilterProps) {
	return (
		<Group justify="center">
			<DateInput
				label="Filter Start Date"
				placeholder="Pick date"
				value={startDate ? dayjs(startDate).format("YYYY-MM-DD") : null}
				minDate={oldestBout}
				maxDate={endDate ?? newestBout}
				clearable
				clearButtonProps={{ "aria-label": "Reset start date" }}
				onChange={value => setStartDate(value ? dayjs(value).toDate() : oldestBout ?? null)}
			/>
			<DateInput
				label="Filter End Date"
				placeholder="Pick date"
				value={endDate ? dayjs(endDate).format("YYYY-MM-DD") : null}
				minDate={startDate ?? oldestBout}
				maxDate={newestBout}
				clearable
				clearButtonProps={{ "aria-label": "Reset end date" }}
				onChange={value => setEndDate(value ? dayjs(value).toDate() : newestBout ?? null)}
			/>
		</Group>
	);
}
