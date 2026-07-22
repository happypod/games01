import { GameScreen } from './components/GameScreen'
import { useGame } from './hooks/useGame'

export function App() {
  const game = useGame()
  return <GameScreen game={game} />
}
