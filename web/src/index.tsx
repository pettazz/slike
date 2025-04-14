import { createRoot } from 'react-dom/client';
import Slike from 'components/Slike';
import 'main.css';

const container = document.getElementById('root') as HTMLDivElement;
const root = createRoot(container);

root.render(<Slike />);
