// JSX 속성 값으로만 쓰이는 변수
const onClickHandler = () => console.log("clicked");
const className = "btn";
const isDisabled = false;
const buttonId = "main-btn";

function App() {
  return (
    <button
      id={buttonId}
      className={className}
      disabled={isDisabled}
      onClick={onClickHandler}
    >
      Click
    </button>
  );
}

App();
