import React, { 
  useMemo, 
  useRef, 
  useEffect 
} from 'react';
import { init, getInstanceByDom } from 'echarts';
import { debounce } from 'utils';
import './index.css';

let placeholder: string[] = [],
    dataPlaceholder: [string, number, string][] = [];

let graphOption = {
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
    data: placeholder
  },
  
  singleAxis: {
    axisTick: {},
    axisLabel: {},
    type: 'time',
    axisPointer: {
      animation: true,
      label: {
        show: true
      }
    },
    splitLine: {
      show: true,
      lineStyle: {
        type: 'dashed',
        opacity: 0.8
      }
    }
  },
  series: [
    {
      type: 'themeRiver',
      emphasis: {
        itemStyle: {
          shadowBlur: 20,
          shadowColor: 'rgba(0, 0, 0, 0.8)'
        }
      },
      data: dataPlaceholder
    }
  ]
};

interface IGraphProps {
  fields: string[];
  data: [string, number, string][];
  events: any;
}

export const Graph = ({ fields, data, events }: IGraphProps) => {
  const graphRef = useRef(null),
        option = graphOption;
  option.legend.data = fields;
  option.series[0].data = data;

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