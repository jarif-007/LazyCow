// App.jsx — root component. Think of this like main() in Java.
// Everything user sees lives here for now.

import { useState } from "react";  // useState = like a variable that auto-refreshes UI when changed

function App() {
  // shortcuts = array of shortcut objects (like ArrayList in Java)
  // setShortcuts = only way to update that array (direct assignment won't work — beginner trap)
  const [shortcuts, setShortcuts] = useState([]);

  return (
    <div style={styles.container}>
      
      {/* Top bar */}
      <div style={styles.topBar}>
        <h1 style={styles.title}>🐄 LazyCow</h1>
      </div>

      {/* Main content: list on left, builder on right */}
      <div style={styles.main}>

        {/* LEFT: shortcut list */}
        <div style={styles.panel}>
          <h2>My Shortcuts</h2>
          {shortcuts.length === 0 && <p>No shortcuts yet.</p>}
          {/* Will render shortcut cards here later */}
        </div>

        {/* RIGHT: shortcut builder form */}
        <div style={styles.panel}>
          <h2>Build a Shortcut</h2>
          {/* Will add form here next step */}
        </div>

      </div>
    </div>
  );
}

// Inline styles — like CSS but written as JS object
// In C++ terms: just a struct holding style values
const styles = {
  container: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",          // fill full window height
    fontFamily: "sans-serif",
    backgroundColor: "#1a1a2e",
    color: "#eee",
  },
  topBar: {
    padding: "10px 20px",
    backgroundColor: "#16213e",
    borderBottom: "1px solid #0f3460",
  },
  title: {
    margin: 0,
    fontSize: "22px",
  },
  main: {
    display: "flex",
    flex: 1,                  // take remaining height
    gap: "10px",
    padding: "10px",
  },
  panel: {
    flex: 1,                  // both panels share equal width
    backgroundColor: "#16213e",
    borderRadius: "8px",
    padding: "15px",
    overflowY: "auto",
  },
};

export default App;