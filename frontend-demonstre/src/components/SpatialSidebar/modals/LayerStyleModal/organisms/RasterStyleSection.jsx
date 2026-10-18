import { Select, Button, Spin } from 'antd'
import { CalculatorIcon, PlusIcon, BookmarkPlusIcon, Trash2Icon } from '../atoms/StyleIcons'
import RasterStatsBanner from '../molecules/RasterStatsBanner'
import ClassBreakRow from '../molecules/ClassBreakRow'
import LegendChipsPreview from '../molecules/LegendChipsPreview'

const RasterStyleSection = ({
  stats,
  method,
  setMethod,
  nClasses,
  setNClasses,
  colorRamp,
  setColorRamp,
  detectedLayerRamp,
  standardRamps,
  customRamps,
  onOpenSaveCustomRamp,
  onDeleteCustomRamp,
  classes,
  onClassify,
  calculating,
  loadingInfo,
  onAddClass,
  onUpdateClass,
  onRemoveClass,
  onRampChange,
  t,
}) => {
  return (
    <>
      {/* Raster Statistics Banner */}
      <RasterStatsBanner stats={stats} t={t} />

      {/* Classification Controls Panel */}
      <div className="mt-3.5 p-3.5 bg-slate-50/80 rounded-xl border border-slate-200">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Classification Method */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              {t('classificationMethod', 'Classification Method:')}
            </label>
            <Select
              value={method}
              onChange={(val) => {
                setMethod(val)
                if (val !== 'manual') {
                  onClassify(nClasses, val, colorRamp)
                }
              }}
              className="w-full text-xs"
              options={[
                { value: 'jenks', label: 'Natural Breaks (Jenks)' },
                { value: 'equal_interval', label: 'Equal Interval' },
                { value: 'quantile', label: 'Quantile' },
                { value: 'manual', label: 'Manual (Custom)' },
              ]}
            />
          </div>

          {/* Number of Classes */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Classes:
            </label>
            <Select
              value={nClasses}
              onChange={(val) => {
                setNClasses(val)
                onClassify(val, method, colorRamp)
              }}
              className="w-full text-xs"
              options={[
                { value: 3, label: '3 Classes' },
                { value: 4, label: '4 Classes' },
                { value: 5, label: '5 Classes' },
                { value: 6, label: '6 Classes' },
                { value: 7, label: '7 Classes' },
                { value: 8, label: '8 Classes' },
                { value: 9, label: '9 Classes' },
                { value: 10, label: '10 Classes (Default)' },
                { value: 12, label: '12 Classes' },
                { value: 15, label: '15 Classes' },
              ]}
            />
          </div>

          {/* Color Ramp Selector */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-semibold text-slate-600">
                Color Ramp:
              </label>
              <button
                type="button"
                onClick={onOpenSaveCustomRamp}
                className="text-[10px] text-teal-600 hover:text-teal-700 font-medium flex items-center gap-0.5 hover:underline cursor-pointer"
                title="Simpan susunan warna saat ini sebagai Color Ramp kustom"
              >
                <BookmarkPlusIcon className="w-3 h-3" />
                + Simpan Custom
              </button>
            </div>
            <Select
              value={colorRamp}
              onChange={onRampChange}
              className="w-full text-xs"
            >
              {detectedLayerRamp && (
                <Select.OptGroup label={t('detectedStyleGroup', 'Style Layer Terdeteksi')}>
                  <Select.Option key={detectedLayerRamp.id} value={detectedLayerRamp.id}>
                    <div className="flex items-center gap-2">
                      <div className="flex h-2.5 w-14 rounded overflow-hidden shadow-inner flex-shrink-0">
                        {detectedLayerRamp.colors.map((c, i) => (
                          <div key={i} style={{ backgroundColor: c, flex: 1 }} />
                        ))}
                      </div>
                      <span className="text-xs truncate font-medium text-teal-700">
                        {detectedLayerRamp.name} ({classes.length} {t('classesLabel', 'Kelas')})
                      </span>
                    </div>
                  </Select.Option>
                </Select.OptGroup>
              )}

              <Select.OptGroup label="Standard Color Ramps">
                {standardRamps.map((ramp) => (
                  <Select.Option key={ramp.id} value={ramp.id}>
                    <div className="flex items-center gap-2">
                      <div className="flex h-2.5 w-14 rounded overflow-hidden shadow-inner flex-shrink-0">
                        {ramp.colors.map((c, i) => (
                          <div key={i} style={{ backgroundColor: c, flex: 1 }} />
                        ))}
                      </div>
                      <span className="text-xs truncate">{ramp.name}</span>
                    </div>
                  </Select.Option>
                ))}
              </Select.OptGroup>

              {customRamps.length > 0 && (
                <Select.OptGroup label="Custom Color Ramps (Tersimpan)">
                  {customRamps.map((ramp) => (
                    <Select.Option key={ramp.id} value={ramp.id}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="flex h-2.5 w-14 rounded overflow-hidden shadow-inner flex-shrink-0">
                            {ramp.colors.map((c, i) => (
                              <div key={i} style={{ backgroundColor: c, flex: 1 }} />
                            ))}
                          </div>
                          <span className="text-xs truncate font-medium text-teal-700">{ramp.name}</span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => onDeleteCustomRamp(e, ramp.id)}
                          className="text-slate-400 hover:text-red-500 p-0.5 cursor-pointer"
                          title="Hapus color ramp ini"
                        >
                          <Trash2Icon className="w-3 h-3" />
                        </button>
                      </div>
                    </Select.Option>
                  ))}
                </Select.OptGroup>
              )}
            </Select>
          </div>
        </div>

        {/* Tombol Re-classify */}
        <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-200">
          <span className="text-[11px] text-slate-500">
            SLD Mode: <strong>Intervals (Range Min &ndash; Max)</strong>
          </span>
          <Button
            size="small"
            type="default"
            icon={<CalculatorIcon className="w-3.5 h-3.5 text-teal-600" />}
            onClick={() => onClassify(nClasses, method, colorRamp)}
            loading={calculating}
            className="text-xs flex items-center gap-1 font-medium"
          >
            Classify...
          </Button>
        </div>
      </div>

      {/* Tabel Rentang Kelas (Classification Breaks) */}
      <div className="mt-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-700">
            Draw raster grouping values into classes ({classes.length} classes):
          </span>
          <Button
            type="dashed"
            size="small"
            icon={<PlusIcon className="w-3.5 h-3.5" />}
            onClick={onAddClass}
            className="text-xs flex items-center"
          >
            Add Class
          </Button>
        </div>

        {loadingInfo || calculating ? (
          <div className="flex items-center justify-center py-10 bg-slate-50 rounded-xl border border-slate-200">
            <Spin tip="Calculating raster values &amp; intervals..." />
          </div>
        ) : (
          <div className="max-h-[260px] overflow-y-auto overflow-x-auto pr-1 border border-slate-200 rounded-xl bg-slate-50/50 p-1.5">
            <div className="min-w-[620px] space-y-1.5">
              {/* Header Tabel */}
              <div className="flex items-center gap-2 px-2 py-1 text-[11px] font-semibold text-slate-500 bg-slate-100 rounded-lg">
                <div className="w-24">Symbol</div>
                <div className="w-36">Range (Min - Max)</div>
                <div className="flex-1">Label</div>
                <div className="w-20">Value (&le;)</div>
                <div className="w-20">Opacity</div>
                <div className="w-6"></div>
              </div>

              {classes.map((cls, idx) => (
                <ClassBreakRow
                  key={idx}
                  cls={cls}
                  index={idx}
                  onUpdate={onUpdateClass}
                  onRemove={onRemoveClass}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Live Preview Legenda */}
      <LegendChipsPreview classes={classes} />
    </>
  )
}

export default RasterStyleSection
