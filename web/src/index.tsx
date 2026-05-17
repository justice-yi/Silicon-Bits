/* @refresh reload */
import { render } from 'solid-js/web'
import { Router, Route } from '@solidjs/router'
import './styles/index.css'
import App from './App'
import BugsPage from './pages/BugsPage'
import BugDetailPage from './pages/BugDetailPage'
import NewBugPage from './pages/NewBugPage'
import EditBugPage from './pages/EditBugPage'
import WikisPage from './pages/WikisPage'
import WikiDetailPage from './pages/WikiDetailPage'
import NewWikiPage from './pages/NewWikiPage'
import EditWikiPage from './pages/EditWikiPage'
import SearchPage from './pages/SearchPage'

const root = document.getElementById('root')
render(() => (
  <Router root={App}>
    <Route path="/" component={BugsPage} />
    <Route path="/bugs" component={BugsPage} />
    <Route path="/bugs/new" component={NewBugPage} />
    <Route path="/bugs/:id/edit" component={EditBugPage} />
    <Route path="/bugs/:id" component={BugDetailPage} />
    <Route path="/wikis" component={WikisPage} />
    <Route path="/wikis/new" component={NewWikiPage} />
    <Route path="/wikis/:id/edit" component={EditWikiPage} />
    <Route path="/wikis/:id" component={WikiDetailPage} />
    <Route path="/search" component={SearchPage} />
  </Router>
), root!)
