import React, { 
  useMemo, 
  useRef, 
  useEffect 
} from 'react';
import { init, getInstanceByDom } from 'echarts';
import { debounce } from 'utils';
import './index.css';

let colors = ['#80FFA5', '#00DDFF', '#37A2FF', '#FF0087', '#FFBF00', '#80FFA5', '#00DDFF', '#37A2FF', '#FF0087', '#FFBF00'];

let strPlaceholder: string[] = [],
    numPlaceholder: number[] = [],
    anyPlaceholder: any[] = [];
let graphOption = {
  color: Object.assign([], colors),
  tooltip: {
    trigger: 'axis',
    axisPointer: {
      type: 'line',
      lineStyle: {
        color: 'rgba(0,0,0,0.2)',
        width: 1,
        type: 'solid'
      }
    }
  },
  legend: {
    data: strPlaceholder
  },
  yAxis: [
    {
      type: 'value'
    }
  ],
  xAxis: [
    {
      type: 'category',
      boundaryGap: false,
      data: strPlaceholder
    }
  ],
  series: anyPlaceholder
};

const seriesFactory = (fields: string[], data: number[][]) => {
  let fieldsc = Object.assign([], fields),
      colorsc = Object.assign([], colors);
  return data.map((row) => {
    const color = colorsc.shift(),
          field = fieldsc.shift();

    return {
      name: field,
      type: 'line',
      stack: 'Total',
      smooth: true,
      lineStyle: {
        width: 0
      },
      showSymbol: false,
      areaStyle: {
        opacity: 0.8,
        color: color
      },
      emphasis: {
        focus: 'series'
      },
      data: row
    };
  });
};


interface IGraphProps {
  fields: string[];
  data: number[][];
  hours: string[];
  events: any;
}

export const GraphStack = ({ fields, data, hours, events }: IGraphProps) => {
  const graphRef = useRef(null),
        option = graphOption;
  option.legend.data = fields;
  option.xAxis[0].data = hours;
  option.series = seriesFactory(fields, data);

  const resize = useMemo(() => {
    return debounce(() => {
      if (graphRef.current) {
        const graph = getInstanceByDom(graphRef.current);
        if (graph) { 
          graph.resize();
        }
      }
    }, 50);
  }, []);

  useEffect(() => {
    if (graphRef.current) {
      console.log(option);
      const graph = init(graphRef.current);

      // if (events) {
      //   for (const [key, handler] of Object.entries(events)) {
      //     graph.on(key, (param) => {
      //       handler(param)
      //     });
      //   }
      // }

      const resizeObserver = new ResizeObserver(() => { resize() });
      resizeObserver.observe(graphRef.current);

      return () => { graph?.dispose(); };
    }
  }, []);

  useEffect(() => {
    if (graphRef.current) {
      const graph = getInstanceByDom(graphRef.current);

      if (graph) {
        graph.setOption(option);  
      }
    }
    
  }, [option]);

  return <div ref={graphRef} style={{ width: '100%', height: '350px' }} />;
};