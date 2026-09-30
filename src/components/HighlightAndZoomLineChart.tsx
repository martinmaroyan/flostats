import React, { useEffect } from "react";
import {
	LineChart,
	Line,
	CartesianGrid,
	XAxis,
	YAxis,
	Tooltip,
	ReferenceArea,
	ResponsiveContainer,
} from "recharts";
import FloAPI from "../api/FloAPI";
import { EventObject } from "../api/types/objects/event";
import { WeightClassObject } from "../api/types/objects/weightClass";
import { FloObject } from "../api/types/types";
import { WrestlerObject } from "../api/types/objects/wrestler";
import { WrestlersResponse } from "../api/types/responses";
import { ChartTooltip } from "@mantine/charts";
import { ContentType } from "recharts/types/component/Tooltip";
import { Stack, Title } from "@mantine/core";
import dayjs from "dayjs";


type WeightChartProps = {
	h: number;
	data?: WrestlersResponse<void, Exclude<FloObject, WrestlerObject>> | null;
	startDate?: Date | null;
	endDate?: Date | null;
}

export default function HighlightAndZoomLineChart(props: WeightChartProps) {
	const [data, setData] = React.useState<{ date: number, "Weight Class": number, "Exact Weight": number }[]>([]);
	const [left, setLeft] = React.useState<string | number>("dataMin");
	const [right, setRight] = React.useState<string | number>("dataMax");
	const [refAreaLeft, setRefAreaLeft] = React.useState<string | number>("");
	const [refAreaRight, setRefAreaRight] = React.useState<string | number>("");
	const [top, setTop] = React.useState<string | number>("dataMax+1");
	const [bottom, setBottom] = React.useState<string | number>("dataMin-1");

	useEffect(() => {
		const result = new Map<number, { date: number; "Weight Class": number; "Exact Weight": number; event: string }>();
		const response = props.data;
		if (response) {
			response.data.forEach(wrestler => {
				const event = FloAPI.findIncludedObjectById<EventObject>(wrestler.attributes.eventId, "event", response)?.attributes;
				if (!event) return;

				if (props.startDate && new Date(event.startDateTime) < props.startDate) return;
				if (props.endDate && new Date(event.startDateTime) > props.endDate) return;

				const weightClass = FloAPI.findIncludedObjectById<WeightClassObject>(wrestler.attributes.weightClassId, "weightClass", response)?.attributes;
				if (weightClass) {

					const obj = {
						date: new Date(event.startDateTime).getTime(),
						"Weight Class": isNaN(weightClass.name.split(" ")[0] as unknown as number) ? weightClass.maxWeight : parseInt(weightClass.name.split(" ")[0]),
						"Exact Weight": (wrestler.attributes.exactWeight ?? parseInt(weightClass.name.split(" ")[0])) || weightClass.maxWeight,
						event: event.name,
					};
					result.set(obj.date, obj);
				}
			});
		}
		setData(Array.from(result.values()).sort((a, b) => a.date - b.date));
		setRefAreaLeft("");
		setRefAreaRight("");
		setLeft("dataMin");
		setRight("dataMax");
		setBottom("dataMin-10");
		setTop("dataMax+10");
	}, [props.data, props.startDate, props.endDate]);

	const getAxisYDomain = (from: number, to: number, ref: "Exact Weight" | "Weight Class", offset: number) => {
		const values = data.filter(point => point.date >= from && point.date <= to).map(point => point[ref]);
		return values.length ? [Math.min(...values) - offset, Math.max(...values) + offset] : [0, 1];
	};

	const zoom = () => {

		if (refAreaLeft === refAreaRight || refAreaRight === "") {
			setRefAreaLeft("");
			setRefAreaRight("");
			return;
		}

		let left = refAreaLeft;
		let right = refAreaRight;

		// xAxis domain
		if (refAreaLeft > refAreaRight) {
			// swap value
			const temp = left;
			left = right;
			right = temp;
		}

		// yAxis domain
		const [bottom, top] = getAxisYDomain(left as number, right as number, "Exact Weight", 1);
		//const [bottom2, top2] = getAxisYDomain(refAreaLeft, refAreaRight, "Weight Class", 50);

		setBottom(bottom);
		setTop(top);
		setRefAreaLeft("");
		setRefAreaRight("");
		setData(data.slice());
		setLeft(left);
		setRight(right);
	};

	const zoomOut = () => {
		setData(data.slice());
		setRefAreaLeft("");
		setRefAreaRight("");
		setLeft("dataMin");
		setRight("dataMax");
		setTop("dataMax+1");
		setBottom("dataMin");
		setBottom("dataMin-10");
		setTop("dataMax+10");
	};

	return (
		<div className="highlight-bar-charts" style={{ userSelect: "none", width: "100%" }}>
			<button type="button" className="btn update" onClick={() => zoomOut()}>
        Zoom Out
			</button>

			<ResponsiveContainer width="100%" height={props.h}>
				<LineChart
					width={800}
					height={400}
					data={data}
					onMouseDown={(e) => { if (typeof e.activeLabel === "number") setRefAreaLeft(e.activeLabel); }}
					onMouseMove={(e) => { if (refAreaLeft !== "" && typeof e.activeLabel === "number") setRefAreaRight(e.activeLabel); }}
					onMouseUp={() => zoom()}
				>
					<CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
					<XAxis allowDataOverflow dataKey="date" domain={[left, right]} type="number" tickFormatter={(v: number) => new Date(v).toLocaleDateString()} />
					<YAxis padding={{ top: 15 }} tickLine={{strokeOpacity:0.1}} allowDataOverflow domain={[bottom, top]} type="number" tickCount={14} interval={0} ticks={[106, 113, 120, 126, 132, 138, 144, 150, 157, 165, 175, 190, 215, 285]} unit=" lbs" />
					<Tooltip content={
						(({ label, payload }: { label: string, payload: Record<string, unknown>[] }) => (
							<ChartTooltip
								label={(
									<Stack gap={0}>
										<Title order={4}>{label ? dayjs(label).format("MMMM D, YYYY") : ""}</Title>
										<Title order={5}>{payload.length ? (payload[0].payload as { event: string }).event : ""}</Title>
									</Stack>
								)}
								payload={payload}
								series={[
									/*{ name: "Weight Class", color: "blue" },*/
									{ name: "Exact Weight", color: "red" },
								]}
								valueFormatter={(v: number) => v + " lbs"}
								showColor={true}
							/>
						)) as ContentType<string, string>
					} />
					<Line type="monotone" dataKey="Exact Weight" stroke="#8884d8" animationDuration={300} />
					<Line type="linear" dataKey="Weight Class" stroke="#82ca9d" animationDuration={300} />

					{refAreaLeft && refAreaRight ? (
						<ReferenceArea x1={refAreaLeft} x2={refAreaRight} strokeOpacity={0.3} />
					) : null}
				</LineChart>
			</ResponsiveContainer>
		</div>
	);
}
