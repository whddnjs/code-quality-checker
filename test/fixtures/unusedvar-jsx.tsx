// TSX 파일에서 JSX 안 usage 판정 확인
const title = "Hello";
const Subtitle = "World";

function App() {
  return (
    <div>
      <h1>{title}</h1>
      <Subtitle />
      <button onClick={() => alert(title)}>Click</button>
    </div>
  );
}

// let 재할당
let counter = 0;
counter = counter + 1;
console.log(counter);

// let 재선언만 하고 새 값으로 덮어쓰기
let snapshot = { a: 1 };
snapshot = { a: 2 };
console.log(snapshot);

App();
