import {
  faFireFlameCurved,
  faHeart,
  faLock,
  faShirt,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import {
  CAMP_JOINT_SYNTHESIS_DEFINITIONS,
  CHAPTER1_COSTUME_DEFINITIONS,
  getSeraTrustCost,
} from '../game/camp'
import { formatNumber } from '../game/format'
import {
  CHAPTER1_COSTUME_IDS,
  type Chapter1CostumeId,
  type Chapter1SynthesisId,
  type GameState,
} from '../game/types'
import type { GameCommandFeedback } from '../hooks/useGame'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { GameAsset } from './GameAsset'
import { SynthesisRewardDialog } from './SynthesisRewardDialog'

export type CampSpecialFacilityId = 'bondTraining' | 'costumeRoom' | 'jointSynthesis'

interface CampSpecialFacilitiesProps {
  activeFacility: CampSpecialFacilityId
  state: GameState
  disabled: boolean
  onSetAdultContentAccess: (confirmed: boolean) => GameCommandFeedback
  onSetSeraBondConsent: (consent: 'granted' | 'withdrawn') => GameCommandFeedback
  onSelectCostume: (id: Chapter1CostumeId) => GameCommandFeedback
  onSynthesizeJointBond: (id: Chapter1SynthesisId) => GameCommandFeedback
  onIncreaseSeraTrust: () => void
}

type SynthesisPhase = 'idle' | 'fusing' | 'reward'

const SYNTHESIS_ID = 'chapter1.sera.ember-vow' as const
const SYNTHESIS_DURATION_MS = 720

const FACILITY_COPY = {
  bondTraining: {
    eyebrow: 'BOND TRAINING',
    title: '유대 훈련실',
    description: '대화와 전술 합의를 통해 세라와의 신뢰를 높입니다. 동의 철회에는 어떤 불이익도 없습니다.',
    icon: faHeart,
  },
  costumeRoom: {
    eyebrow: 'COSTUME ROOM',
    title: '의상실',
    description: '해금 원장에 기록된 CHAPTER I 의상만 안전하게 교체합니다.',
    icon: faShirt,
  },
  jointSynthesis: {
    eyebrow: 'JOINT SYNTHESIS',
    title: '합동 연성실',
    description: '두 사람의 잿불을 합쳐 한 번만 지급되는 고정 무기 카드를 연성합니다.',
    icon: faFireFlameCurved,
  },
} as const

function isCostumeUnlocked(state: GameState, id: Chapter1CostumeId): boolean {
  const definition = CHAPTER1_COSTUME_DEFINITIONS[id]
  return (state.camp.bond.unlockedCostumeMask & definition.unlockBit) !== 0
}

export function CampSpecialFacilities({
  activeFacility,
  state,
  disabled,
  onSetAdultContentAccess,
  onSetSeraBondConsent,
  onSelectCostume,
  onSynthesizeJointBond,
  onIncreaseSeraTrust,
}: CampSpecialFacilitiesProps) {
  const [adultAcknowledged, setAdultAcknowledged] = useState(false)
  const [synthesisPhase, setSynthesisPhase] = useState<SynthesisPhase>('idle')
  const [rewardOpen, setRewardOpen] = useState(false)
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)', false)
  const synthesisRoomRef = useRef<HTMLDivElement>(null)
  const adultAcknowledgementId = useId()
  const synthesisReasonId = useId()
  const facility = FACILITY_COPY[activeFacility]
  const sera = state.camp.residents.sera
  const bond = state.camp.bond
  const accessReady = bond.adultAccessConfirmed
    && bond.seraConsent === 'granted'
    && sera.status === 'contracted'

  const currentCostume = CHAPTER1_COSTUME_DEFINITIONS[bond.currentCostumeId]
  const synthesis = CAMP_JOINT_SYNTHESIS_DEFINITIONS[SYNTHESIS_ID]
  const rewardClaimed = (bond.claimedSynthesisRewardMask & synthesis.reward.claimBit) !== 0
  const synthesisAffordable = state.player.gold >= synthesis.cost.gold
    && state.camp.materials.ashShard >= synthesis.cost.materials.ashShard
    && state.camp.materials.beastHide >= synthesis.cost.materials.beastHide
    && state.camp.materials.emberCore >= synthesis.cost.materials.emberCore

  useEffect(() => {
    if (synthesisPhase !== 'fusing') return
    const timer = window.setTimeout(() => {
      setSynthesisPhase('reward')
      setRewardOpen(true)
    }, SYNTHESIS_DURATION_MS)
    return () => window.clearTimeout(timer)
  }, [synthesisPhase])

  const confirmAdultAccess = () => {
    const feedback = onSetAdultContentAccess(true)
    if (feedback.success && feedback.reason === 'committed') setAdultAcknowledged(false)
  }

  const runSynthesis = () => {
    const feedback = onSynthesizeJointBond(SYNTHESIS_ID)
    if (!feedback.success || feedback.reason !== 'committed') return
    if (reducedMotion) {
      setSynthesisPhase('reward')
      setRewardOpen(true)
      return
    }
    setSynthesisPhase('fusing')
  }

  const closeReward = useCallback(() => setRewardOpen(false), [])

  const synthesisDisabledReason = disabled
    ? '현재 탭에서는 명령을 실행할 수 없습니다.'
    : !accessReady
      ? '성인 확인과 세라의 자율 동의가 모두 필요합니다.'
      : synthesisPhase !== 'idle'
        ? '연성 결과를 확인하고 있습니다.'
        : rewardClaimed
          ? '이 보상은 이미 수집 원장에 지급되었습니다.'
          : !synthesisAffordable
            ? '연성 재료나 골드가 부족합니다.'
            : '필요 재화를 차감하고 고정 보상을 한 번만 지급합니다.'

  return (
    <section
      className="camp-special-facilities"
      aria-labelledby={`camp-special-${activeFacility}-title`}
      data-testid="camp-special-facilities"
      data-consent-status={bond.seraConsent}
      data-active-facility={activeFacility}
    >
      <header className="camp-special-facilities__header">
        <span className="camp-special-facilities__icon" aria-hidden="true">
          <FontAwesomeIcon icon={facility.icon} fixedWidth />
        </span>
        <div>
          <p className="eyebrow">{facility.eyebrow}</p>
          <h3 id={`camp-special-${activeFacility}-title`}>{facility.title}</h3>
          <p>{facility.description}</p>
        </div>
      </header>

      <section className="bond-consent-contract" aria-labelledby="bond-consent-title">
        <div className="bond-consent-contract__heading">
          <div>
            <p className="eyebrow">MUTUAL CONSENT</p>
            <h4 id="bond-consent-title">성인 캐릭터 상호 동의 계약</h4>
          </div>
          <span className={`bond-consent-contract__status bond-consent-contract__status--${accessReady ? 'ready' : 'locked'}`}>
            <FontAwesomeIcon icon={accessReady ? faHeart : faLock} fixedWidth aria-hidden="true" />
            {accessReady ? '상호 동의 활성' : '보호 잠금'}
          </span>
        </div>

        {!bond.adultAccessConfirmed ? (
          <div className="bond-consent-contract__step">
            <label htmlFor={adultAcknowledgementId}>
              <input
                id={adultAcknowledgementId}
                type="checkbox"
                checked={adultAcknowledged}
                disabled={disabled}
                onChange={(event) => setAdultAcknowledged(event.currentTarget.checked)}
              />
              <span>나는 18세 이상이며, 등장인물은 모두 성인이고 상호 동의는 언제든 철회 가능한 원칙을 확인했습니다.</span>
            </label>
            <button
              type="button"
              disabled={disabled || !adultAcknowledged}
              onClick={confirmAdultAccess}
            >
              성인 콘텐츠 접근 확인
            </button>
          </div>
        ) : sera.status !== 'contracted' ? (
          <div className="bond-consent-contract__step">
            <p className="bond-consent-contract__notice">
              세라의 구조와 자발적 캠프 계약을 먼저 완료해야 유대 시설을 열 수 있습니다.
            </p>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onSetAdultContentAccess(false)}
            >
              성인 콘텐츠 접근 끄기
            </button>
          </div>
        ) : bond.seraConsent === 'granted' ? (
          <div className="bond-consent-contract__step bond-consent-contract__step--active">
            <p>세라가 현재 유대 시설 이용에 명시적으로 동의했습니다. 철회해도 보상과 진행은 사라지지 않습니다.</p>
            <div className="bond-consent-contract__actions">
              <button
                type="button"
                disabled={disabled}
                onClick={() => onSetSeraBondConsent('withdrawn')}
              >
                동의 철회
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onSetAdultContentAccess(false)}
              >
                성인 콘텐츠 접근 끄기
              </button>
            </div>
          </div>
        ) : (
          <div className="bond-consent-contract__step">
            <p>
              {bond.seraConsent === 'withdrawn'
                ? '세라가 동의를 철회했습니다. 불이익 없이 다시 확인할 때까지 모든 특수 시설이 잠깁니다.'
                : '세라의 자율적인 동의를 별도로 확인해야 특수 시설을 이용할 수 있습니다.'}
            </p>
            <div className="bond-consent-contract__actions">
              <button
                type="button"
                disabled={disabled}
                onClick={() => onSetSeraBondConsent('granted')}
              >
                세라의 자율 동의 확인
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onSetAdultContentAccess(false)}
              >
                성인 콘텐츠 접근 끄기
              </button>
            </div>
          </div>
        )}
      </section>

      {activeFacility === 'bondTraining' && (() => {
        const trustCost = getSeraTrustCost(sera.trust)
        const trustAtMaximum = trustCost === null
        const cannotAfford = trustCost !== null && state.player.gold < trustCost
        return (
          <div className="bond-room" data-bond-room="training">
            <div className="bond-room__metric">
              <span>세라 유대</span>
              <strong>{sera.trust}/5</strong>
              <small>전투 성과와 무관한 자발적 대화 훈련</small>
            </div>
            <button
              type="button"
              disabled={disabled || !accessReady || trustAtMaximum || cannotAfford}
              onClick={onIncreaseSeraTrust}
              aria-label={trustAtMaximum
                ? '세라 유대 훈련 완료'
                : `세라 유대 훈련 · ${formatNumber(trustCost)} 골드`}
            >
              {trustAtMaximum ? '유대 MAX' : `대화 훈련 · ${formatNumber(trustCost)} G`}
            </button>
          </div>
        )
      })()}

      {activeFacility === 'costumeRoom' && !accessReady && (
        <div className="bond-special-lock" data-bond-room="costume-locked">
          <FontAwesomeIcon icon={faLock} fixedWidth aria-hidden="true" />
          <strong>의상 자산 보호 잠금</strong>
          <p>성인 확인과 세라의 현재 동의가 모두 활성화된 뒤에만 CHAPTER I 의상 이미지를 불러옵니다.</p>
        </div>
      )}

      {activeFacility === 'costumeRoom' && accessReady && (
        <div className="bond-costume-room" data-bond-room="costume">
          <GameAsset
            assetId={currentCostume.manifestAssetId}
            purpose="character"
            alt={`성인 정찰병 세라가 ${currentCostume.name}을 착용한 모습`}
            fallbackLabel="세라"
            className="bond-costume-room__preview"
            fit="cover"
            loading="eager"
          />
          <div className="bond-costume-room__controls">
            <p>
              <strong>{currentCostume.name}</strong>
              <small>{currentCostume.id}</small>
            </p>
            <fieldset disabled={disabled || !accessReady}>
              <legend>세라 의상</legend>
              {CHAPTER1_COSTUME_IDS.map((id) => {
                const definition = CHAPTER1_COSTUME_DEFINITIONS[id]
                const unlocked = isCostumeUnlocked(state, id)
                return (
                  <label key={id} data-costume-id={id} data-costume-unlocked={unlocked}>
                    <input
                      type="radio"
                      name="sera-costume"
                      value={id}
                      checked={bond.currentCostumeId === id}
                      disabled={!unlocked}
                      onChange={() => onSelectCostume(id)}
                    />
                    <span>
                      <strong>{definition.name}</strong>
                      <small>{unlocked ? '해금됨' : '잠김'}</small>
                    </span>
                  </label>
                )
              })}
            </fieldset>
          </div>
        </div>
      )}

      {activeFacility === 'jointSynthesis' && !accessReady && (
        <div className="bond-special-lock" data-bond-room="synthesis-locked">
          <FontAwesomeIcon icon={faLock} fixedWidth aria-hidden="true" />
          <strong>연성 자산 보호 잠금</strong>
          <p>상호 동의가 활성화되기 전에는 실루엣과 보상 자산을 마운트하거나 미리 불러오지 않습니다.</p>
        </div>
      )}

      {activeFacility === 'jointSynthesis' && accessReady && (
        <div
          ref={synthesisRoomRef}
          className={`bond-synthesis bond-synthesis--${synthesisPhase}`}
          data-testid="joint-synthesis"
          data-synthesis-phase={synthesisPhase}
          data-bond-room="synthesis"
          tabIndex={-1}
        >
          <div className="bond-synthesis__stage" aria-hidden="true">
            <GameAsset
              assetId="hero.ashen-knight.default"
              purpose="character"
              decorative
              fallbackLabel="아렌"
              className="bond-synthesis__actor bond-synthesis__actor--hero"
              fit="contain"
              loading="eager"
            />
            <GameAsset
              assetId={currentCostume.manifestAssetId}
              purpose="character"
              decorative
              fallbackLabel="세라"
              className="bond-synthesis__actor bond-synthesis__actor--sera"
              fit="contain"
              loading="eager"
            />
            <span className="bond-synthesis__flame">
              <FontAwesomeIcon icon={faFireFlameCurved} fixedWidth />
            </span>
          </div>

          <div className="bond-synthesis__command">
            <div>
              <p className="eyebrow">FIXED RECIPE</p>
              <h4>{synthesis.name}</h4>
              <dl>
                <div><dt>골드</dt><dd>{formatNumber(synthesis.cost.gold)}</dd></div>
                <div><dt>재의 파편</dt><dd>{synthesis.cost.materials.ashShard}</dd></div>
                <div><dt>야수 가죽</dt><dd>{synthesis.cost.materials.beastHide}</dd></div>
                <div><dt>불씨 핵</dt><dd>{synthesis.cost.materials.emberCore}</dd></div>
              </dl>
            </div>
            <button
              type="button"
              disabled={disabled || !accessReady || rewardClaimed || !synthesisAffordable || synthesisPhase !== 'idle'}
              aria-describedby={synthesisReasonId}
              onClick={runSynthesis}
            >
              {synthesisPhase === 'fusing'
                ? '연성 중…'
                : synthesisPhase === 'reward' || rewardClaimed
                  ? '보상 지급 완료'
                  : '합동 연성 시작'}
            </button>
            <p id={synthesisReasonId}>{synthesisDisabledReason}</p>
            <p className="bond-synthesis__status" role="status" aria-live="polite">
              {synthesisPhase === 'fusing'
                ? '두 실루엣의 잿불을 합치고 있습니다.'
                : synthesisPhase === 'reward'
                  ? `${synthesis.reward.name} 지급이 확정되었습니다.`
                  : rewardClaimed
                    ? `${synthesis.reward.name}이 수집 원장에 기록되어 있습니다.`
                    : '결과는 저장 성공 뒤에만 공개됩니다.'}
            </p>
          </div>
        </div>
      )}

      {rewardOpen && accessReady && (
        <SynthesisRewardDialog
          rewardId={synthesis.reward.id}
          rewardName={synthesis.reward.name}
          fallbackFocusRef={synthesisRoomRef}
          onClose={closeReward}
        />
      )}
    </section>
  )
}
