import { render } from 'preact'
import Router from 'preact-router';
import { App } from './app.js';
import { PalmLiteApp } from './palm-lite.js';
import { CompletionApp } from './completion.js';
import { REPLApp } from './repl.js';
import { BreadboardViewerApp } from './breadboard-viewer.js';
import './index.css';
import { Header } from './components/header.js';
import { Footer } from './components/footer.js';

const Container = ({ children }) => {
  return (<>
    <Header></Header>
    {children}
    <Footer></Footer>
  </>)
}

const Main = () => (
  <Router>
    <Container path="/"><App /></Container>
    <Container path="/breadboard-viewer"><BreadboardViewerApp /></Container>
    <Container path="/completion"><CompletionApp /></Container>
    <Container path="/palm-lite"><PalmLiteApp /></Container>
    <Container path="/repl"><REPLApp /></Container>
  </Router>
);

render(<Main />, document.body);